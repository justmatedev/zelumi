import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createWorker} from '../cloudflare/worker.mjs';
import {hashToken,deriveCsrf} from '../cloudflare/auth/crypto.mjs';
import {migrate} from './helpers/d1.mjs';
process.env.WRANGLER_LOG_PATH=resolve('.wrangler/logs');process.env.WRANGLER_SEND_METRICS='false';const {getPlatformProxy}=await import('wrangler');
const now=1793617200000,origin='https://test.workers.dev';
const record={description:'Pão %_',type:'despesa',category:'Alimentação',date:'2026-01-31',amount:100000,installments:12,installmentStartMonth:null};
test('API financeira com sessão real local, versões e idempotência',async t=>{
 const p=await getPlatformProxy({configPath:'tests/wrangler.jsonc',persist:false,remoteBindings:false,envFiles:[resolve('.dev.vars.example')]});t.after(()=>p.dispose());const db=p.env.DB;await migrate(db);
 const env={DB:db,APP_ORIGIN:origin,TELEGRAM_BOT_USERNAME:'test_bot',TELEGRAM_BOT_TOKEN:'123:fake'},worker=createWorker({clock:()=>new Date(now)}),token='a'.repeat(64),csrf=await deriveCsrf(token,env.TELEGRAM_BOT_TOKEN,'session');
 for(const [owner,key] of [['11',token],['22','b'.repeat(64)]]){
 await db.prepare('INSERT INTO web_users VALUES(?,?,?,?,?,?)').bind(owner,'Teste',null,null,now,now).run();await db.prepare('INSERT INTO web_sessions VALUES(?,?,?,?)').bind(await hashToken(key),owner,now,now+86400000).run();}
 await db.prepare("INSERT INTO cloud_records(id,owner,body) VALUES('1','11',?)").bind(JSON.stringify(record)).run();
 const send=(path,method='GET',body,headers={})=>worker.fetch(new Request(origin+path,{method,headers:{Cookie:`__Host-zelumi_session=${token}`,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':csrf,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
 await t.test('resumo mensal e busca Unicode/literal; isolamento e validação',async()=>{
  const r=await send('/api/finance/overview?month=2026-02');assert.equal(r.status,200);const d=await r.json();assert.equal(d.expense,8334);assert.equal(d.result,-8334);
  for(const q of ['PÃO','pão','%_']){const h=await (await send('/api/finance/entries?q='+encodeURIComponent(q))).json();assert.equal(h.total,12);}
  assert.equal((await send('/api/finance/records/1','GET',undefined,{Cookie:`__Host-zelumi_session=${'b'.repeat(64)}`})).status,404);
  assert.equal((await send('/api/finance/entries?pageSize=100')).status,400);assert.equal((await send('/api/finance/entries?owner=22')).status,400);
  assert.equal((await send('/api/finance/entries','GET',undefined,{Cookie:''})).status,401);
 });
 await t.test('PUT concorrente/replay altera uma vez; DELETE repetido e estado snapshot',async()=>{
  const detail=await (await send('/api/finance/records/1')).json();const key=randomUUID(),body={expectedVersion:detail.version,record:{...record,amount:240000}};
  const responses=await Promise.all([send('/api/finance/records/1','PUT',body,{'Idempotency-Key':key}),send('/api/finance/records/1','PUT',body,{'Idempotency-Key':key})]);assert.ok(responses.every(r=>r.status===200));
  assert.equal((await db.prepare("SELECT version FROM cloud_state WHERE owner='11'").first()).version,1);
  assert.equal((await send('/api/finance/records/1','PUT',{...body,record:{...record,amount:30000}},{'Idempotency-Key':key})).status,409);
  assert.equal((await send('/api/finance/records/1','PUT',body,{'Idempotency-Key':randomUUID()})).status,409);
  assert.equal((await send('/api/finance/entries?page=2&snapshot=0')).status,409);
  assert.equal((await send('/api/finance/records/1','PUT',body,{'Idempotency-Key':randomUUID(),Origin:'https://evil.example'})).status,403);
  const latest=await (await send('/api/finance/records/1')).json(),delkey=randomUUID();
  assert.equal((await send('/api/finance/records/1','DELETE',{expectedVersion:latest.version},{'Idempotency-Key':delkey})).status,200);
  assert.equal((await send('/api/finance/records/1','DELETE',{expectedVersion:latest.version},{'Idempotency-Key':delkey})).status,200);
  assert.equal((await send('/api/finance/records/1')).status,404);assert.equal((await db.prepare('SELECT COUNT(*) n FROM finance_projection').first()).n,0);
 });
});
