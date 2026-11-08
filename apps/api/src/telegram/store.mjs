import { randomUUID } from 'node:crypto';
import { localDate } from '@zelumi/bot-core/engine';
import {prepareOwner} from '../finance/projection.mjs';
import {monthlySQL,projectionInsert,projectionArgs} from '@zelumi/finance/server/sql';
import {recordVersion} from '@zelumi/finance/server/version';
import {safeTotals} from '@zelumi/finance/model';
import {resolveCategory} from '../categories/classifier.mjs';

const decode = row => row ? {...JSON.parse(row.body),version:recordVersion(row.body),categorySource:row.record_version===recordVersion(row.body)?row.category_source:'unknown',id:/^\d+$/.test(row.id)&&Number.isSafeInteger(Number(row.id))?Number(row.id):row.id} : null;
const summarySQL = `SELECT COUNT(*) AS count, COALESCE(SUM(CASE WHEN type='receita' THEN amount ELSE 0 END),0) AS income, COALESCE(SUM(CASE WHEN type='despesa' THEN amount ELSE 0 END),0) AS expense FROM cloud_records WHERE owner=? AND date>=? AND date<?`;

// Carrega um conjunto limitado para o motor síncrono existente. Cada commit usa
// uma versão por usuário e uma chave única por update: ou tudo é salvo, ou nada é.
export class D1Store {
  constructor(db,{botId,timezone='America/Sao_Paulo',now=new Date(),classify,aiEnv={}}={}) {
    // A sessão evita leituras defasadas se read replication estiver habilitada.
    this.db=db.withSession?db.withSession('first-primary'):db;
    this.botId=botId;this.timezone=timezone;this.now=now;this.classify=classify;this.aiEnv=aiEnv;
  }
  stmt(sql,...args) {return this.db.prepare(sql).bind(...args);}
  async process(update,handler) {
    const message=update.callback_query?.message||update.message;
    const sender=update.callback_query?.from||message?.from;
    this.owner=String(sender?.id||'ignored');this.update=update.update_id;this.attempt=randomUUID();this.ops=[];this.candidates=[];
    await this.db.batch([
      this.stmt("INSERT OR IGNORE INTO cloud_meta(key,value) VALUES ('bot_id',?)",this.botId),
      this.stmt('INSERT OR IGNORE INTO cloud_state(owner) VALUES (?)',this.owner)
    ]);
    const today=localDate(this.now,this.timezone), month=today.slice(0,7);
    const [year,m]=month.split('-').map(Number);
    const nextMonth=`${year+(m===12?1:0)}-${String(m%12+1).padStart(2,'0')}-01`;
    const snapshot=await this.db.batch([
      this.stmt("SELECT value FROM cloud_meta WHERE key='bot_id'"),
      this.stmt('SELECT id FROM cloud_processed WHERE id=?',this.update),
      this.stmt('SELECT version,pending FROM cloud_state WHERE owner=?',this.owner),
      this.stmt('SELECT r.id,r.body,m.source category_source,m.record_version FROM cloud_records r LEFT JOIN category_record_meta m ON m.owner=r.owner AND m.record_id=r.id WHERE r.owner=? ORDER BY r.sequence DESC LIMIT 10',this.owner),
      this.stmt(summarySQL,this.owner,today,today+'z'),
      this.stmt('SELECT 1')
    ]);
    if(snapshot[0].results[0]?.value!==this.botId) throw new Error('D1 pertence a outro bot.');
    if(snapshot[1].results.length) return false;
    const prepared=await prepareOwner(this.db,this.owner);
    const monthly=prepared.status==='ready'?safeTotals(await this.stmt(monthlySQL('cloud_records'),this.owner,month,month,month).first()):prepared;
    const state=snapshot[2].results[0];this.version=state.version;this.pendingValue=state.pending?JSON.parse(state.pending):null;
    this.rows=snapshot[3].results.map(decode);this.summaries=new Map([[today,snapshot[4].results[0]],[month,monthly]]);
    const target=(update.callback_query?.data||'').split(':')[1]||this.pendingValue?.editing;
    if(target&&!this.rows.some(r=>String(r.id)===String(target))) {
      const row=await this.stmt('SELECT r.id,r.body,m.source category_source,m.record_version FROM cloud_records r LEFT JOIN category_record_meta m ON m.owner=r.owner AND m.record_id=r.id WHERE r.owner=? AND r.id=?',this.owner,String(target)).first();
      if(row)this.rows.push(decode(row));
    }
    handler();
    for(const {record,preserve,source} of this.candidates){
      if(preserve){record.categorySource=source;continue;}
      try{const result=await (this.classify||resolveCategory)({db:this.db,owner:this.owner,record,nowMs:this.now.getTime(),env:this.aiEnv});record.category=result.category;record.categorySource=result.source;}
      catch{record.categorySource='fallback';}
    }
    const gate='EXISTS (SELECT 1 FROM cloud_processed WHERE id=? AND attempt=?)';
    const statements=[this.stmt(`INSERT OR IGNORE INTO cloud_processed(id,owner,attempt,created_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM cloud_state WHERE owner=? AND version=?) AND EXISTS(SELECT 1 FROM cloud_meta WHERE key='bot_id' AND value=?)`,this.update,this.owner,this.attempt,this.now.getTime(),this.owner,this.version,this.botId)];
    for(const {sql,args} of this.ops.flatMap(op=>typeof op==='function'?op():op)) statements.push(this.stmt(sql.replaceAll('$GATE',gate),...args,this.update,this.attempt));
    statements.push(this.stmt(`UPDATE cloud_state SET version=version+1 WHERE owner=? AND ${gate}`,this.owner,this.update,this.attempt));
    const result=await this.db.batch(statements);
    if(!result[0].meta.changes) {
      const duplicate=await this.stmt('SELECT id FROM cloud_processed WHERE id=?',this.update).first();
      if(duplicate)return false;
      throw new Error('Conflito de versão; Telegram deve reenviar.');
    }
    return true;
  }
  op(sql,...args){this.ops.push({sql,args});}
  check(owner){if(owner!==this.owner)throw new Error('Escopo de usuário inválido.');}
  recent(owner,limit){this.check(owner);return this.rows.slice(0,limit);}
  record(owner,id){this.check(owner);return this.rows.find(r=>String(r.id)===String(id))||null;}
  summary(owner,period){this.check(owner);return this.summaries.get(period);}
  pending(owner){this.check(owner);return this.pendingValue;}
  setPending(owner,value){this.check(owner);this.pendingValue=value;this.op('UPDATE cloud_state SET pending=? WHERE owner=? AND $GATE',JSON.stringify(value),owner);}
  clearPending(owner){this.check(owner);this.pendingValue=null;this.op('UPDATE cloud_state SET pending=NULL WHERE owner=? AND $GATE',owner);}
  categorize(owner,record,options={}){this.check(owner);this.candidates.push({record,...options});}
  recordOps(owner,id,record,editing){
    const {categorySource,...stored}=record,body=JSON.stringify(stored);
    const meta={sql:'INSERT INTO category_record_meta(owner,record_id,source,record_version) SELECT ?,?,?,? WHERE $GATE ON CONFLICT(owner,record_id) DO UPDATE SET source=excluded.source,record_version=excluded.record_version',args:[owner,String(id),categorySource||'unknown',recordVersion(body)]};
    return [editing?{sql:'UPDATE cloud_records SET body=? WHERE owner=? AND id=? AND $GATE',args:[body,owner,String(id)]}:{sql:'INSERT INTO cloud_records(id,owner,body) SELECT ?,?,? WHERE $GATE',args:[String(id),owner,body]},{sql:projectionInsert('cloud_records','$GATE'),args:projectionArgs(owner,id,body)},meta];
  }
  insert(owner,record){this.check(owner);const id=randomUUID();this.ops.push(()=>this.recordOps(owner,id,record,false));return id;}
  replace(owner,id,record){this.check(owner);if(!this.record(owner,id))return false;this.ops.push(()=>this.recordOps(owner,id,record,true));return true;}
  remove(owner,id){this.check(owner);if(!this.record(owner,id))return false;this.op('DELETE FROM cloud_records WHERE owner=? AND id=? AND $GATE',owner,String(id));return true;}
  enqueue(method,payload){this.ops.push(()=>({sql:'INSERT INTO cloud_outbox(update_id,method,payload) SELECT ?,?,? WHERE $GATE',args:[this.update,method,JSON.stringify(typeof payload==='function'?payload():payload)]}));}
}
