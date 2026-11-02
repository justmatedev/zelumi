import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class Store {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS processed (id INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, body TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS records_owner ON records(owner);
      CREATE TABLE IF NOT EXISTS pending (owner TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT, method TEXT NOT NULL, payload TEXT NOT NULL
      );
    `);
  }
  getMeta(key) { return this.db.prepare('SELECT value FROM meta WHERE key=?').get(key)?.value; }
  setMeta(key, value) { this.db.prepare('INSERT OR REPLACE INTO meta VALUES (?,?)').run(key, String(value)); }
  get offset() { return Number(this.getMeta('offset') || 0); }
  // A alteração financeira, a resposta e o cursor são gravados juntos.
  process(update, handler) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.db.prepare('SELECT id FROM processed WHERE id=?').get(update.update_id)) {
        this.db.exec('COMMIT'); return false;
      }
      handler();
      this.db.prepare('INSERT INTO processed VALUES (?)').run(update.update_id);
      this.setMeta('offset', Math.max(this.offset, update.update_id + 1));
      this.db.exec('COMMIT'); return true;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  list(owner) { return this.db.prepare('SELECT id, body FROM records WHERE owner=? ORDER BY id').all(owner).map(row => ({...JSON.parse(row.body), id: Number(row.id)})); }
  recent(owner, limit) { return this.db.prepare('SELECT id,body FROM records WHERE owner=? ORDER BY id DESC LIMIT ?').all(owner,limit).map(row=>({...JSON.parse(row.body),id:Number(row.id)})); }
  summary(owner, period) {
    const row=this.db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(CASE WHEN json_extract(body,'$.type')='receita' THEN json_extract(body,'$.amount') ELSE 0 END),0) AS income, COALESCE(SUM(CASE WHEN json_extract(body,'$.type')='despesa' THEN json_extract(body,'$.amount') ELSE 0 END),0) AS expense FROM records WHERE owner=? AND json_extract(body,'$.date') LIKE ?`).get(owner,period+'%');
    return {...row};
  }
  record(owner, id) { const row = this.db.prepare('SELECT body FROM records WHERE owner=? AND id=?').get(owner, id); return row ? {...JSON.parse(row.body), id: Number(id)} : null; }
  insert(owner, record) { return Number(this.db.prepare('INSERT INTO records(owner,body) VALUES (?,?)').run(owner, JSON.stringify(record)).lastInsertRowid); }
  replace(owner, id, record) { return this.db.prepare('UPDATE records SET body=? WHERE owner=? AND id=?').run(JSON.stringify(record), owner, id).changes > 0; }
  remove(owner, id) { return this.db.prepare('DELETE FROM records WHERE owner=? AND id=?').run(owner, id).changes > 0; }
  pending(owner) { const row = this.db.prepare('SELECT body FROM pending WHERE owner=?').get(owner); return row ? JSON.parse(row.body) : null; }
  setPending(owner, value) { this.db.prepare('INSERT OR REPLACE INTO pending VALUES (?,?)').run(owner, JSON.stringify(value)); }
  clearPending(owner) { this.db.prepare('DELETE FROM pending WHERE owner=?').run(owner); }
  enqueue(method, payload) { this.db.prepare('INSERT INTO outbox(method,payload) VALUES (?,?)').run(method, JSON.stringify(payload)); }
  nextDelivery() { const row=this.db.prepare('SELECT * FROM outbox ORDER BY id LIMIT 1').get(); return row ? {...row,payload:JSON.parse(row.payload)} : null; }
  delivered(id) { this.db.prepare('DELETE FROM outbox WHERE id=?').run(id); }
  close() { this.db.close(); }
}
