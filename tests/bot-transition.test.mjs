import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {migrate} from './helpers/d1.mjs';
import {createWorker} from '../apps/api/src/worker.mjs';
import {D1Store} from '../apps/api/src/telegram/store.mjs';
import {deliver} from '../apps/api/src/telegram/outbox.mjs';
import {hashToken} from '../apps/api/src/auth/crypto.mjs';
import {deriveCsrf} from '../apps/api/src/auth/crypto.mjs';
import {recordVersion} from '@zelumi/finance/server/version';
import {randomUUID} from 'node:crypto';

process.env.WRANGLER_LOG_PATH=resolve('.wrangler/logs');
process.env.WRANGLER_SEND_METRICS='false';
const {getPlatformProxy}=await import('wrangler');
const now=new Date('2026-11-02T12:00:00Z'),secret='local_transition_secret_at_least_32_characters';
const record={description:'Notebook',type:'despesa',amount:100001,installments:12,date:'2026-01-31',category:'Outros'};
const message=(id,text)=>({update_id:id,message:{message_id:id,date:Math.floor(now.getTime()/1000),from:{id:11},chat:{id:11,type:'private'},text}});
const request=update=>new Request('https://test.workers.dev/telegram/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':secret},body:JSON.stringify(update)});

test('troca de bot preserva finanças e isola o estado operacional',async t=>{
 const p=await getPlatformProxy({configPath:'tests/wrangler.jsonc',persist:false,remoteBindings:false,envFiles:[resolve('.dev.vars.example')]});t.after(()=>p.dispose());const db=p.env.DB;await migrate(db);
 const env={DB:db,TELEGRAM_BOT_TOKEN:'123:old',TELEGRAM_WEBHOOK_SECRET:secret,APP_ORIGIN:'https://test.workers.dev',TELEGRAM_BOT_USERNAME:'test_bot'};
 const next={...env,TELEGRAM_BOT_TOKEN:'999:new'};
 const worker=createWorker({clock:()=>now,apiFactory:()=>async()=>true});
 const count=async table=>Number((await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first()).n);
 const switchBot=()=>db.prepare("UPDATE cloud_meta SET value='999' WHERE key='bot_id' AND value='123' RETURNING value").all();
 async function reset(){
  for(const table of ['cloud_outbox','cloud_processed','cloud_state','cloud_records','cloud_meta','web_sessions','web_auth_flows','web_auth_accepts','web_auth_limits','web_users','finance_operations'])await db.prepare(`DELETE FROM ${table}`).run();
  await db.prepare("INSERT INTO cloud_meta VALUES('bot_id','123')").run();
  await db.prepare("INSERT INTO cloud_records(id,owner,body) VALUES('1','11',?)").bind(JSON.stringify(record)).run();
  await db.prepare("INSERT INTO cloud_state VALUES('11',7,'{\"mode\":\"editing\"}')").run();
  await db.prepare("INSERT INTO cloud_processed VALUES(1,'11','old',?)").bind(now.getTime()).run();
  await db.prepare("INSERT INTO web_users VALUES('11','Teste',NULL,NULL,?,?)").bind(now.getTime(),now.getTime()).run();
  await db.prepare("INSERT INTO web_sessions VALUES(?,'11',?,?)").bind(await hashToken('a'.repeat(64)),now.getTime(),now.getTime()+86400000).run();
  await db.prepare("INSERT INTO web_auth_flows VALUES('flow','csrf',?,?)").bind(now.getTime(),now.getTime()+600000).run();
  await db.prepare("INSERT INTO web_auth_accepts VALUES('used','payload','attempt',?)").bind(now.getTime()).run();
  await db.prepare("INSERT INTO web_auth_limits VALUES('network',0,1)").run();
 }
 await t.test('troca atômica preserva corpos e usuários, limpa estado antigo e invalida snapshots',async()=>{
  await reset();const before=await db.prepare('SELECT id,owner,body,sequence FROM cloud_records').all();
  const changed=await switchBot();assert.equal(changed.results.length,1);
  assert.deepEqual((await db.prepare('SELECT id,owner,body,sequence FROM cloud_records').all()).results,before.results);
  assert.equal(await count('web_users'),1);
  for(const table of ['cloud_processed','web_sessions','web_auth_flows','web_auth_accepts','web_auth_limits'])assert.equal(await count(table),0,table);
  assert.deepEqual(await db.prepare("SELECT version,pending FROM cloud_state WHERE owner='11'").first(),{version:8,pending:null});
  assert.equal((await switchBot()).results.length,0);
  assert.equal((await db.prepare("SELECT version FROM cloud_state WHERE owner='11'").first()).version,8);
 });
 await t.test('fila pendente impede troca sem apagar nada',async()=>{
  await reset();await db.prepare("INSERT INTO cloud_outbox(update_id,method,payload) VALUES(1,'sendMessage','{}')").run();
  await assert.rejects(switchBot);
  assert.equal((await db.prepare("SELECT value FROM cloud_meta WHERE key='bot_id'").first()).value,'123');
  assert.equal(await count('cloud_outbox'),1);assert.equal(await count('cloud_processed'),1);assert.equal(await count('web_sessions'),1);
  assert.equal((await db.prepare("SELECT version FROM cloud_state WHERE owner='11'").first()).version,7);
 });
 await t.test('falha durante a limpeza reverte vínculo e limpezas anteriores',async()=>{
  await reset();await db.prepare("CREATE TRIGGER fail_switch BEFORE DELETE ON web_sessions BEGIN SELECT RAISE(ABORT,'test rollback'); END").run();
  try{await assert.rejects(switchBot);assert.equal((await db.prepare("SELECT value FROM cloud_meta WHERE key='bot_id'").first()).value,'123');assert.equal(await count('cloud_processed'),1);assert.equal(await count('web_sessions'),1);}
  finally{await db.prepare('DROP TRIGGER fail_switch').run();}
 });
 await t.test('update ID repetido no bot novo registra compra nova sem substituir a antiga',async()=>{
  await reset();await switchBot();assert.equal((await worker.fetch(request(message(1,'pão 10')),next)).status,200);
  assert.equal(await count('cloud_records'),2);assert.equal(JSON.parse((await db.prepare("SELECT body FROM cloud_records WHERE id='1'").first()).body).amount,100001);
 });
 await t.test('requisição antiga não grava se a troca ocorrer entre leitura e commit',async()=>{
  await reset();let race=false;
  const dbRace={prepare:sql=>db.prepare(sql),async batch(statements){if(race){race=false;await switchBot();}return db.batch(statements);}};
  const store=new D1Store(dbRace,{botId:'123',now});
  await assert.rejects(store.process(message(2,'uber 20'),()=>{store.insert('11',record);race=true;}));
  assert.equal(await count('cloud_records'),1);assert.equal(await count('cloud_processed'),0);assert.equal(await count('cloud_outbox'),0);
 });
 await t.test('entregador antigo não envia respostas novas com o token errado',async()=>{
  await reset();await switchBot();await db.prepare("INSERT INTO cloud_outbox(update_id,method,payload) VALUES(2,'sendMessage','{\"chat_id\":11,\"text\":\"nova\"}')").run();
  const sent=[];const api=async(method,payload)=>{sent.push({method,payload});};
  assert.equal(await deliver(db,api,{botId:'123',now:now.getTime()}),0);assert.equal(sent.length,0);assert.equal(await count('cloud_outbox'),1);
  assert.equal(await deliver(db,api,{botId:'999',now:now.getTime()}),1);assert.equal(sent[0].payload.text,'nova');assert.equal(await count('cloud_outbox'),0);
 });
 await t.test('saúde, login e sessão recusam token de outro bot após a troca',async()=>{
  await reset();await switchBot();
  await db.prepare("INSERT INTO web_sessions VALUES(?,'11',?,?)").bind(await hashToken('b'.repeat(64)),now.getTime(),now.getTime()+86400000).run();
  for(const path of ['/health','/api/session','/api/finance/overview?month=2026-01']){
   const req=()=>new Request(env.APP_ORIGIN+path,{headers:{Cookie:`__Host-zelumi_session=${'b'.repeat(64)}`}});
   assert.equal((await worker.fetch(req(),env)).status,503,path);assert.equal((await worker.fetch(req(),next)).status,200,path);
  }
  const login=()=>new Request(env.APP_ORIGIN+'/auth/telegram/start',{method:'POST',headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/json'},body:'{}'});
  assert.equal((await worker.fetch(login(),env)).status,503);assert.equal((await worker.fetch(login(),next)).status,200);
 });
 await t.test('PUT e DELETE não gravam se a troca revogar a sessão após sua leitura',async()=>{
  for(const kind of ['PUT','DELETE']){
   await reset();let armed=true;
   const dbRace={
    prepare(sql){
     const stmt=db.prepare(sql);if(!sql.includes('JOIN web_users'))return stmt;
     return {bind(...args){const bound=stmt.bind(...args);return {async first(){const row=await bound.first();if(armed){armed=false;await switchBot();}return row;}};}};
    },batch:statements=>db.batch(statements)
   };
   const old=await db.prepare("SELECT body FROM cloud_records WHERE id='1'").first();
   const body={expectedVersion:recordVersion(old.body),...(kind==='PUT'?{record:{...record,amount:200000}}:{})};
   const req=new Request(env.APP_ORIGIN+'/api/finance/records/1',{method:kind,headers:{Origin:env.APP_ORIGIN,Cookie:`__Host-zelumi_session=${'a'.repeat(64)}`,'Content-Type':'application/json','X-CSRF-Token':await deriveCsrf('a'.repeat(64),env.TELEGRAM_BOT_TOKEN,'session'),'Idempotency-Key':randomUUID()},body:JSON.stringify(body)});
   const response=await worker.fetch(req,{...env,DB:dbRace});
   assert.equal(response.status,401,kind);
   assert.equal((await db.prepare("SELECT body FROM cloud_records WHERE id='1'").first()).body,old.body);
   assert.equal(await count('finance_operations'),0);
  }
 });
});
