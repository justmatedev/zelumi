import {buildProjection} from './version.mjs';
const tableName=t=>{if(!['cloud_records','records'].includes(t))throw new Error('Invalid table');return t;};
export function projectionSchema(table){tableName(table);return [
 'CREATE TABLE IF NOT EXISTS finance_projection(owner TEXT NOT NULL,record_id TEXT NOT NULL,source_version TEXT NOT NULL,search_name TEXT NOT NULL,schedule_json TEXT NOT NULL,first_month TEXT NOT NULL,last_month TEXT NOT NULL,PRIMARY KEY(owner,record_id))',
 'CREATE INDEX IF NOT EXISTS finance_projection_month ON finance_projection(owner,first_month,last_month)',
 `CREATE TRIGGER IF NOT EXISTS finance_update AFTER UPDATE OF body,id,owner ON ${table} BEGIN DELETE FROM finance_projection WHERE owner=OLD.owner AND record_id=CAST(OLD.id AS TEXT); END`,
 `CREATE TRIGGER IF NOT EXISTS finance_delete AFTER DELETE ON ${table} BEGIN DELETE FROM finance_projection WHERE owner=OLD.owner AND record_id=CAST(OLD.id AS TEXT); END`,
 'CREATE TABLE IF NOT EXISTS finance_operations(owner TEXT NOT NULL,operation_key TEXT NOT NULL,request_hash TEXT NOT NULL,attempt_id TEXT NOT NULL UNIQUE,record_id TEXT NOT NULL,kind TEXT NOT NULL,response_json TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,PRIMARY KEY(owner,operation_key))',
 'CREATE INDEX IF NOT EXISTS finance_operations_expiry ON finance_operations(expires_at)'
 ];}
export function projectionInsert(table,gate='1') {tableName(table);return `INSERT INTO finance_projection(owner,record_id,source_version,search_name,schedule_json,first_month,last_month)
 SELECT owner,CAST(id AS TEXT),?,?,?,?,? FROM ${table} WHERE owner=? AND CAST(id AS TEXT)=? AND body=? AND ${gate}
 ON CONFLICT(owner,record_id) DO UPDATE SET source_version=excluded.source_version,search_name=excluded.search_name,schedule_json=excluded.schedule_json,first_month=excluded.first_month,last_month=excluded.last_month`;}
export function projectionArgs(owner,id,body){const p=buildProjection(body);return [p.version,p.searchName,p.scheduleJson,p.firstMonth,p.lastMonth,owner,String(id),body];}
export const missingSQL=table=>`SELECT r.id,r.body FROM ${tableName(table)} r LEFT JOIN finance_projection p ON p.owner=r.owner AND p.record_id=CAST(r.id AS TEXT) WHERE r.owner=? AND p.record_id IS NULL LIMIT ?`;
export function monthlySQL(table){tableName(table);return `SELECT COUNT(*) count,COALESCE(SUM(CASE WHEN json_extract(r.body,'$.type')='receita' THEN json_extract(j.value,'$.amount') ELSE 0 END),0) income,COALESCE(SUM(CASE WHEN json_extract(r.body,'$.type')='despesa' THEN json_extract(j.value,'$.amount') ELSE 0 END),0) expense FROM finance_projection p JOIN ${table} r ON r.owner=p.owner AND CAST(r.id AS TEXT)=p.record_id JOIN json_each(p.schedule_json) j WHERE p.owner=? AND p.first_month<=? AND p.last_month>=? AND substr(json_extract(j.value,'$.date'),1,7)=?`;}
