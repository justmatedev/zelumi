import {randomUUID} from 'node:crypto';
import {FinanceError,safeTotals,readStored,normalizeSearch,validateEdit,schedule} from '../../finance/model.mjs';
import {recordVersion} from '../../finance/version.mjs';
import {projectionInsert,projectionArgs,missingAnySQL} from '../../finance/sql.mjs';
import {prepareOwner} from './projection.mjs';
const from=`FROM finance_projection p JOIN cloud_records r ON r.owner=p.owner AND r.id=p.record_id JOIN json_each(p.schedule_json) j`;
const date="json_extract(j.value,'$.date')",amount="json_extract(j.value,'$.amount')",type="json_extract(r.body,'$.type')",category="json_extract(r.body,'$.category')",parts="json_extract(r.body,'$.installments')";
const select=`SELECT r.id recordId,CAST(j.key AS INTEGER)+1 installment,${parts} installments,${date} date,substr(${date},1,7) month,${amount} amount,json_extract(r.body,'$.amount') totalAmount,json_extract(r.body,'$.description') description,${type} type,${category} category`;
const order=`ORDER BY ${date} DESC,r.sequence DESC,CAST(j.key AS INTEGER) DESC`;
const fail=(code,message,status=409)=>{throw new FinanceError(code,message,status);};
function filter(owner,f,skipCategory=false){
 const clauses=['p.owner=?'],args=[owner];
 if(f.month){clauses.push(`p.first_month<=? AND p.last_month>=? AND substr(${date},1,7)=?`);args.push(f.month,f.month,f.month);}
 if(f.q){clauses.push('instr(p.search_name,?)>0');args.push(normalizeSearch(f.q));}
 if(f.type){clauses.push(`${type}=?`);args.push(f.type);}
 if(f.category&&!skipCategory){clauses.push(`${category}=?`);args.push(f.category);}
 if(f.parts==='yes')clauses.push(`${parts}>1`);else if(f.parts==='no')clauses.push(`${parts}=1`);
 return {where:'WHERE '+clauses.join(' AND '),args};
}
export class FinanceStore {
 constructor(db){this.db=db;}
 stmt(sql,...args){return this.db.prepare(sql).bind(...args);}
 state(owner){return this.stmt('SELECT COALESCE((SELECT version FROM cloud_state WHERE owner=?),0) snapshot',owner);}
 async ready(owner){const p=await prepareOwner(this.db,owner);if(p.status!=='ready')fail(p.status==='invalid'?'HISTORY_INVALID':'HISTORY_PREPARING',p.status==='invalid'?'Um lançamento antigo precisa de revisão.':'Preparando seu histórico. Tente novamente em instantes.',503);}
 async detail(owner,id){const row=await this.stmt('SELECT body FROM cloud_records WHERE owner=? AND id=?',owner,id).first();if(!row)fail('NOT_FOUND','Lançamento não encontrado.',404);return {id,version:recordVersion(row.body),...readStored(row.body)};}
 async entries(owner,f){
  await this.ready(owner);const {where,args}=filter(owner,f),cats=filter(owner,f,true);
  const batch=await this.db.batch([this.state(owner),this.stmt(`${select} ${from} ${where} ${order} LIMIT ? OFFSET ?`,...args,f.pageSize,(f.page-1)*f.pageSize),this.stmt(`SELECT COUNT(*) total ${from} ${where}`,...args),this.stmt(`SELECT DISTINCT ${category} category ${from} ${cats.where} ORDER BY category`,...cats.args),this.stmt(missingAnySQL('cloud_records'),owner,1)]);
  if(batch[4].results.length)fail('HISTORY_PREPARING','O histórico está sendo preparado. Tente novamente.',503);
  const snapshot=batch[0].results[0].snapshot;if(f.snapshot!==undefined&&f.snapshot!==snapshot)fail('HISTORY_CHANGED','O histórico mudou. Voltamos à primeira página.');
  const total=batch[2].results[0].total;safeTotals({total});return {items:batch[1].results.map(safeTotals),total,page:f.page,pageSize:f.pageSize,snapshot,categories:batch[3].results.map(r=>r.category)};
 }
 async overview(owner,month){
  await this.ready(owner);const {where,args}=filter(owner,{month});
  const sum=condition=>`COALESCE(SUM(CASE WHEN ${condition} THEN ${amount} ELSE 0 END),0)`;
  const batch=await this.db.batch([this.state(owner),this.stmt(`SELECT COUNT(*) count,${sum(`${type}='receita'`)} income,${sum(`${type}='despesa'`)} expense,${sum(`${type}='despesa' AND ${parts}>1`)} installmentExpense,${sum(`${type}='despesa' AND ${parts}=1`)} cashExpense ${from} ${where}`,...args),this.stmt(`SELECT ${category} category,SUM(${amount}) amount ${from} ${where} AND ${type}='despesa' GROUP BY ${category} ORDER BY amount DESC,category`,...args),this.stmt(`${select} ${from} ${where} ${order} LIMIT 10`,...args),this.stmt(missingAnySQL('cloud_records'),owner,1)]);
  if(batch[4].results.length)fail('HISTORY_PREPARING','O histórico está sendo preparado. Tente novamente.',503);
  const totals=safeTotals(batch[1].results[0]);return safeTotals({month,snapshot:batch[0].results[0].snapshot,...totals,result:totals.income-totals.expense,categories:batch[2].results.map(safeTotals),recent:batch[3].results.map(safeTotals)});
 }
 async receipt(owner,key,hash,nowMs){const row=await this.stmt('SELECT request_hash,response_json FROM finance_operations WHERE owner=? AND operation_key=? AND expires_at>?',owner,key,nowMs).first();if(!row)return null;if(row.request_hash!==hash)fail('OPERATION_KEY_REUSED','Esta ação já foi usada com outros dados.');return JSON.parse(row.response_json);}
 async mutate({owner,id,kind,expectedVersion,record,operationKey,nowMs}){
  const validated=kind==='PUT'?validateEdit(record):null;
  const hash=recordVersion(JSON.stringify({id,kind,expectedVersion,record:validated}));
  const replay=await this.receipt(owner,operationKey,hash,nowMs);if(replay)return replay;
  const old=await this.stmt('SELECT body FROM cloud_records WHERE owner=? AND id=?',owner,id).first();if(!old)fail('NOT_FOUND','Lançamento não encontrado.',404);
  if(recordVersion(old.body)!==expectedVersion)fail('RECORD_CHANGED','Este lançamento mudou. Recarregue os dados antes de salvar.');
  await this.stmt('INSERT OR IGNORE INTO cloud_state(owner) VALUES(?)',owner).run();const state=await this.state(owner).first();
  const edited=kind==='PUT'?{...JSON.parse(old.body),...validated,schedule:schedule(validated)}:null;
  if(edited&&!edited.installmentStartMonth)delete edited.installmentStartMonth;
  const next=edited?JSON.stringify(edited):null,response=next?{ok:true,version:recordVersion(next)}:{ok:true},attempt=randomUUID();
  const gate='EXISTS(SELECT 1 FROM finance_operations WHERE attempt_id=?)';
  const queries=[this.stmt('DELETE FROM finance_operations WHERE owner=? AND operation_key=? AND expires_at<=?',owner,operationKey,nowMs),this.stmt(`INSERT INTO finance_operations(owner,operation_key,request_hash,attempt_id,record_id,kind,response_json,created_at,expires_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM cloud_records WHERE owner=? AND id=? AND body=?) AND EXISTS(SELECT 1 FROM cloud_state WHERE owner=? AND version=?) ON CONFLICT DO NOTHING`,owner,operationKey,hash,attempt,id,kind,JSON.stringify(response),nowMs,nowMs+86400000,owner,id,old.body,owner,state.snapshot)];
  queries.push(next?this.stmt(`UPDATE cloud_records SET body=? WHERE owner=? AND id=? AND ${gate}`,next,owner,id,attempt):this.stmt(`DELETE FROM cloud_records WHERE owner=? AND id=? AND ${gate}`,owner,id,attempt));
  if(next)queries.push(this.stmt(projectionInsert('cloud_records',gate),...projectionArgs(owner,id,next),attempt));
  queries.push(this.stmt(`UPDATE cloud_state SET version=version+1 WHERE owner=? AND ${gate}`,owner,attempt));
  const result=await this.db.batch(queries);
  if(result[1].meta.changes===1)return response;
  const duplicate=await this.receipt(owner,operationKey,hash,nowMs);if(duplicate)return duplicate;
  fail('RECORD_CHANGED','O histórico mudou durante a ação. Recarregue para tentar novamente.');
 }
}
export const cleanupFinance=(db,nowMs)=>db.prepare('DELETE FROM finance_operations WHERE (owner,operation_key) IN (SELECT owner,operation_key FROM finance_operations WHERE expires_at<=? LIMIT 500)').bind(nowMs).run();
