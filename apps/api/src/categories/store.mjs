import {randomUUID} from 'node:crypto';
import {FinanceError} from '@zelumi/finance/model';
import {expenseCategories} from '@zelumi/finance/categories';
import {recordVersion} from '@zelumi/finance/server/version';
import {suggestTerms,normalizeCategoryDescription} from '@zelumi/finance/category-memory';

export class CategoryStore {
 constructor(db,authorization=null){this.db=db;this.authorization=authorization;}
 stmt(sql,...args){return this.db.prepare(sql).bind(...args);}
 async lookup(owner,key,nowMs,modelVersion=''){
  const {results}=await this.stmt('SELECT category,source,revision,expires_at,model_version FROM category_memory WHERE owner=? AND description_key=?',owner,key).all();
  const manual=results.find(r=>r.source==='manual'),ai=results.find(r=>r.source==='ai'&&r.expires_at>nowMs&&r.model_version===modelVersion);
  return {manual:manual?.category??null,revision:manual?.revision??null,ai:ai?.category??null};
 }
 async detail(owner,record,version){
  const key=normalizeCategoryDescription(record.description),memory=await this.lookup(owner,key,Date.now());
  const meta=await this.stmt('SELECT source FROM category_record_meta WHERE owner=? AND record_id=? AND record_version=?',owner,record.id,version).first();
  return {categoryMemory:memory.manual===null?null:{category:memory.manual,revision:memory.revision},categorySource:meta?.source??'unknown'};
 }
 memoryStatement({owner,description,category,action,nowMs,revision,gate,args}){
  const key=normalizeCategoryDescription(description);
  if(action==='forget')return this.stmt(`DELETE FROM category_memory WHERE owner=? AND description_key=? AND source='manual' AND ${gate}`,owner,key,...args);
  return this.stmt(`INSERT INTO category_memory(owner,description_key,source,category,updated_at,revision) SELECT ?,?,'manual',?,?,? WHERE ${gate} ON CONFLICT(owner,description_key,source) DO UPDATE SET category=excluded.category,revision=excluded.revision,updated_at=excluded.updated_at`,owner,key,category,nowMs,revision,...args);
 }
 metaStatement(owner,id,source,version,gate,args){return this.stmt(`INSERT INTO category_record_meta(owner,record_id,source,record_version) SELECT ?,?,?,? WHERE ${gate} ON CONFLICT(owner,record_id) DO UPDATE SET source=excluded.source,record_version=excluded.record_version`,owner,String(id),source,version,...args);}
 async cacheAI(owner,key,category,modelVersion,nowMs){
  await this.stmt(`INSERT INTO category_memory(owner,description_key,source,category,updated_at,expires_at,model_version) VALUES(?,?,'ai',?,?,?,?) ON CONFLICT(owner,description_key,source) DO UPDATE SET category=excluded.category,updated_at=excluded.updated_at,expires_at=excluded.expires_at,model_version=excluded.model_version`,owner,key,category,nowMs,nowMs+30*86400000,modelVersion).run();
 }
 async reserveAttempt(owner,dayUTC,{global=200,user=20}={}){
  const token=randomUUID(),scope='user:'+owner;
  const result=await this.db.batch([
   this.stmt('INSERT OR IGNORE INTO category_ai_budget(day_utc,scope) VALUES(?,?)',dayUTC,'global'),
   this.stmt('INSERT OR IGNORE INTO category_ai_budget(day_utc,scope) VALUES(?,?)',dayUTC,scope),
   this.stmt("UPDATE category_ai_budget SET attempts=attempts+1,reservation=? WHERE day_utc=? AND scope='global' AND attempts<? AND (SELECT attempts FROM category_ai_budget WHERE day_utc=? AND scope=?)<?",token,dayUTC,global,dayUTC,scope,user),
   this.stmt("UPDATE category_ai_budget SET attempts=attempts+1 WHERE day_utc=? AND scope=? AND EXISTS(SELECT 1 FROM category_ai_budget WHERE day_utc=? AND scope='global' AND reservation=?)",dayUTC,scope,dayUTC,token)
  ]);
  return result[2].meta.changes===1;
 }
 async blocked(nowMs){const row=await this.stmt("SELECT blocked_until FROM category_ai_state WHERE key='global'").first();return !!row&&row.blocked_until>nowMs;}
 async pause(until,reason){await this.stmt("INSERT INTO category_ai_state(key,blocked_until,reason) VALUES('global',?,?) ON CONFLICT(key) DO UPDATE SET blocked_until=MAX(blocked_until,excluded.blocked_until),reason=CASE WHEN excluded.blocked_until>=blocked_until THEN excluded.reason ELSE reason END",until,reason).run();}

 async terms(owner){const {results}=await this.stmt('SELECT phrase_key phrase,category FROM category_terms WHERE owner=? ORDER BY length(phrase_key) DESC LIMIT 200',owner).all();return results;}
 async list(owner,resource,page=0){
  const terms=resource==='terms',table=terms?'category_terms':'category_memory',column=terms?'phrase_key':'description_key',extra=terms?'':" AND source='manual'";
  const {results}=await this.stmt(`SELECT ${column} key,category,revision FROM ${table} WHERE owner=?${extra} ORDER BY ${column} LIMIT 51 OFFSET ?`,owner,page*50).all();
  const response={items:results.slice(0,50),nextPage:results.length>50?page+1:null,suggestions:[]};
  if(terms){const {results:manual}=await this.stmt("SELECT description_key,category,source FROM category_memory WHERE owner=? AND source='manual' ORDER BY updated_at DESC LIMIT 1000",owner).all();const existing=await this.terms(owner);const candidates=suggestTerms(manual).filter(r=>!existing.some(e=>e.phrase===r.phrase));
   if(candidates.length){const conflicts=await this.db.batch(candidates.map(r=>this.stmt("SELECT 1 conflict FROM category_memory WHERE owner=? AND source='manual' AND category<>? AND instr(' '||description_key||' ',' '||?||' ')>0 LIMIT 1",owner,r.category,r.phrase)));response.suggestions=candidates.filter((_,i)=>!conflicts[i].results.length);}}
  return response;
 }
 async manage({owner,resource,method,key,category,expectedRevision,operationKey,nowMs}){
  const fail=(code,message,status=409)=>{throw new FinanceError(code,message,status);};
  if(!['terms','memory'].includes(resource)||!['PUT','DELETE'].includes(method)||typeof key!=='string'||!key.trim()||key.length>(resource==='terms'?100:500)||!normalizeCategoryDescription(key)||!(expectedRevision===null||Number.isSafeInteger(expectedRevision)&&expectedRevision>0)||method==='PUT'&&!expenseCategories.includes(category))fail('INVALID_REQUEST','Verifique a regra e a categoria.',400);
  key=normalizeCategoryDescription(key);
  const hash=recordVersion(JSON.stringify({resource,method,key,category:method==='PUT'?category:null,expectedRevision}));
  const receipt=async()=>{const row=await this.stmt('SELECT request_hash,response_json FROM finance_operations WHERE owner=? AND operation_key=? AND expires_at>?',owner,operationKey,nowMs).first();if(!row)return null;if(row.request_hash!==hash)fail('OPERATION_KEY_REUSED','Esta ação já foi usada com outros dados.');return JSON.parse(row.response_json);};
  const replay=await receipt();if(replay)return replay;
  const terms=resource==='terms',table=terms?'category_terms':'category_memory',column=terms?'phrase_key':'description_key',extra=terms?'':" AND source='manual'";
  const old=await this.stmt(`SELECT revision FROM ${table} WHERE owner=? AND ${column}=?${extra}`,owner,key).first();
  if((old?.revision??null)!==expectedRevision||method==='DELETE'&&!old){const committed=await receipt();if(committed)return committed;fail('RULE_CHANGED','A associação mudou. Recarregue antes de tentar novamente.');}
  if(method==='PUT'&&!old&&terms&&(await this.stmt('SELECT COUNT(*) n FROM category_terms WHERE owner=?',owner).first()).n>=200)fail('RULE_LIMIT','Você já tem 200 termos. Remova um antes de adicionar outro.',400);
  await this.stmt('INSERT OR IGNORE INTO cloud_state(owner) VALUES(?)',owner).run();
  const state=await this.stmt('SELECT version FROM cloud_state WHERE owner=?',owner).first(),attempt=randomUUID(),gate='EXISTS(SELECT 1 FROM finance_operations WHERE attempt_id=?)';
  const auth=this.authorization,authorized=auth?"EXISTS(SELECT 1 FROM web_sessions WHERE token_hash=? AND owner=? AND expires_at>?) AND (NOT EXISTS(SELECT 1 FROM cloud_meta WHERE key='bot_id') OR EXISTS(SELECT 1 FROM cloud_meta WHERE key='bot_id' AND value=?))":'1',authArgs=auth?[auth.sessionHash,owner,nowMs,auth.botId]:[];
  const response={ok:true,revision:method==='PUT'?state.version+1:null};
  const unchanged=old?`EXISTS(SELECT 1 FROM ${table} WHERE owner=? AND ${column}=?${extra} AND revision=?)`:`NOT EXISTS(SELECT 1 FROM ${table} WHERE owner=? AND ${column}=?${extra})`,unchangedArgs=old?[owner,key,old.revision]:[owner,key];
  const capacity=terms&&method==='PUT'&&!old?'AND (SELECT COUNT(*) FROM category_terms WHERE owner=?)<200':'',capacityArgs=capacity?[owner]:[];
  const queries=[this.stmt(`DELETE FROM finance_operations WHERE owner=? AND operation_key=? AND expires_at<=? AND ${authorized}`,owner,operationKey,nowMs,...authArgs),this.stmt(`INSERT INTO finance_operations(owner,operation_key,request_hash,attempt_id,record_id,kind,response_json,created_at,expires_at) SELECT ?,?,?,?,?,?,?,?,? WHERE ${unchanged} AND EXISTS(SELECT 1 FROM cloud_state WHERE owner=? AND version=?) AND ${authorized} ${capacity} ON CONFLICT DO NOTHING`,owner,operationKey,hash,attempt,key,'category:'+resource+':'+method,JSON.stringify(response),nowMs,nowMs+86400000,...unchangedArgs,owner,state.version,...authArgs,...capacityArgs)];
  if(method==='DELETE')queries.push(this.stmt(`DELETE FROM ${table} WHERE owner=? AND ${column}=?${extra} AND ${gate}`,owner,key,attempt));
  else if(terms)queries.push(this.stmt(`INSERT INTO category_terms(owner,phrase_key,category,created_at,revision) SELECT ?,?,?,?,? WHERE ${gate} ON CONFLICT(owner,phrase_key) DO UPDATE SET category=excluded.category,revision=excluded.revision`,owner,key,category,nowMs,response.revision,attempt));
  else queries.push(this.memoryStatement({owner,description:key,category,action:'remember',nowMs,revision:response.revision,gate,args:[attempt]}));
  queries.push(this.stmt(`UPDATE cloud_state SET version=version+1 WHERE owner=? AND ${gate}`,owner,attempt));
  const result=await this.db.batch(queries);if(result[1].meta.changes===1)return response;
  if(auth&&!await this.stmt(`SELECT 1 allowed WHERE ${authorized}`,...authArgs).first())fail('SESSION_ENDED','Sessão encerrada. Entre novamente.',401);
  const committed=await receipt();if(committed)return committed;fail('RULE_CHANGED','Suas associações mudaram. Recarregue antes de tentar novamente.');
 }

}

export async function cleanupCategories(db,nowMs){
 const cutoff=new Date(nowMs-7*86400000).toISOString().slice(0,10);
 await db.batch([
  db.prepare("DELETE FROM category_memory WHERE (owner,description_key,source) IN (SELECT owner,description_key,source FROM category_memory WHERE source='ai' AND expires_at<=? LIMIT 500)").bind(nowMs),
  db.prepare('DELETE FROM category_ai_budget WHERE (day_utc,scope) IN (SELECT day_utc,scope FROM category_ai_budget WHERE day_utc<? LIMIT 500)').bind(cutoff)
 ]);
}
