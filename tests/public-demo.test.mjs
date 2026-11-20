import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {migrate} from './helpers/d1.mjs';
import {createDemoWorker} from '../apps/api/demo/worker.mjs';
import {createWorker} from '../apps/api/src/worker.mjs';
process.env.WRANGLER_LOG_PATH=resolve('.wrangler/logs');
process.env.WRANGLER_SEND_METRICS='false';
const {getPlatformProxy}=await import('wrangler');
const origin='https://demo.example.com';
test('demonstração pública isola visitantes e limpa somente contas vencidas',async t=>{
 const p=await getPlatformProxy({configPath:'tests/wrangler.jsonc',persist:false,remoteBindings:false,envFiles:[]});t.after(()=>p.dispose());
 const env={DB:p.env.DB,APP_ORIGIN:origin,DEMO_ENABLED:'true',CATEGORY_AI_ENABLED:'false',TELEGRAM_BOT_TOKEN:'999001:public_demo_only',TELEGRAM_BOT_USERNAME:'zelumi_demo_bot'};
 await migrate(env.DB);
 let now=new Date('2026-11-20T15:00:00Z');const worker=createDemoWorker({clock:()=>now});
 const request=(path,method='GET',data,headers={})=>new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});
 await t.test('exige inicialização explícita de banco exclusivo',async()=>{
  assert.equal((await worker.fetch(request('/auth/demo','POST',{}),env)).status,503);
  const sql=readFileSync(new URL('../apps/api/demo/schema.sql',import.meta.url),'utf8');
  await env.DB.batch(sql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>env.DB.prepare(s)));
 });
 await t.test('rejeita origem externa, outro host, método inválido e campos extras',async()=>{
  assert.equal((await worker.fetch(request('/auth/demo','POST',{}, {Origin:'https://evil.example'}),env)).status,403);
  assert.equal((await worker.fetch(new Request('https://evil.example/auth/demo',{method:'POST'}),env)).status,403);
  assert.equal((await worker.fetch(request('/auth/demo'),env)).status,405);
  assert.equal((await worker.fetch(request('/auth/demo','POST',{owner:'123'}),env)).status,400);
  assert.equal((await worker.fetch(request('/auth/telegram/config'),env)).status,404);
  assert.equal((await worker.fetch(request('/telegram/webhook','POST',{}),env)).status,404);
 });
 async function login(ip){
  const result=await worker.fetch(request('/auth/demo','POST',{}, {'CF-Connecting-IP':ip}),env);assert.equal(result.status,200);
  assert.match(result.headers.get('Set-Cookie'),/Secure; HttpOnly; SameSite=Lax; Max-Age=86400/);
  const cookie=result.headers.get('Set-Cookie').split(';')[0];
  const session=await worker.fetch(request('/api/session','GET',undefined,{Cookie:cookie}),env);assert.equal(session.status,200);
  return {cookie,csrf:(await session.json()).csrfToken};
 }
 const first=await login('192.0.2.1'),second=await login('192.0.2.2');
 const send=(visitor,path,method='GET',data,extra={})=>worker.fetch(request(path,method,data,{Cookie:visitor.cookie,'X-CSRF-Token':visitor.csrf,'Idempotency-Key':randomUUID(),...extra}),env);
 let record;
 await t.test('cada visitante recebe dados fictícios no mês atual e IDs próprios',async()=>{
  const overview=await send(first,'/api/finance/overview?month=2026-11');assert.equal(overview.status,200);
  assert.equal((await overview.json()).income,650000);
  const entries=await (await send(first,'/api/finance/entries?month=2026-11')).json();
  // Fetch the underlying record to exercise the real detail/mutation contract.
  const row=await env.DB.prepare('SELECT id FROM cloud_records ORDER BY sequence LIMIT 1').first();
  record=await (await send(first,'/api/finance/records/'+row.id)).json();
  assert.equal(record.description,'Salário de exemplo');assert.equal(record.date,'2026-11-01');
  assert.ok(entries);
  assert.equal((await send(second,'/api/finance/records/'+record.id)).status,404);
 });
 await t.test('edição exige CSRF e afeta somente a conta atual',async()=>{
  const {id,version,schedule,categoryMemory,categorySource,...input}=record;
  const data={expectedVersion:version,record:{...input,amount:700000}};
  assert.equal((await send(first,'/api/finance/records/'+id,'PUT',data,{'X-CSRF-Token':''})).status,403);
  assert.equal((await send(first,'/api/finance/records/'+id,'PUT',data)).status,200);
  assert.equal((await (await send(second,'/api/finance/overview?month=2026-11')).json()).income,650000);
 });
 await t.test('exclusão atua somente sobre a conta autenticada',async()=>{
  const detail=await (await send(first,'/api/finance/records/'+record.id)).json();
  assert.equal((await send(second,'/api/finance/records/'+record.id,'DELETE',{expectedVersion:detail.version})).status,404);
  assert.equal((await send(first,'/api/finance/records/'+record.id,'DELETE',{expectedVersion:detail.version})).status,200);
  assert.equal((await send(first,'/api/finance/records/'+record.id)).status,404);
  assert.equal((await (await send(second,'/api/finance/overview?month=2026-11')).json()).income,650000);
 });
 await t.test('falha ao criar sessão desfaz perfil, visitante e registros do mesmo login',async()=>{
  const before=await env.DB.prepare('SELECT COUNT(*) AS n FROM web_users').first();
  const records=await env.DB.prepare('SELECT COUNT(*) AS n FROM cloud_records').first();
  await env.DB.prepare("CREATE TRIGGER demo_test_session_failure BEFORE INSERT ON web_sessions BEGIN SELECT RAISE(ABORT,'test failure'); END").run();
  try{
   assert.equal((await worker.fetch(request('/auth/demo','POST',{}, {'CF-Connecting-IP':'192.0.2.50'}),env)).status,503);
   assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM web_users').first()).n,before.n);
   assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM demo_visitors').first()).n,before.n);
   assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM cloud_records').first()).n,records.n);
  }finally{await env.DB.prepare('DROP TRIGGER demo_test_session_failure').run();}
 });
 await t.test('limita criação repetida de contas por rede',async()=>{
  for(let i=0;i<5;i++)await login('192.0.2.9');
  const result=await worker.fetch(request('/auth/demo','POST',{}, {'CF-Connecting-IP':'192.0.2.9'}),env);
  assert.equal(result.status,429);assert.ok(Number(result.headers.get('Retry-After'))>0);
 });
 await t.test('uma sessão encerrada não pode ser reutilizada; entrar novamente reinicia os exemplos',async()=>{
  assert.equal((await send(first,'/api/session/logout','POST',{})).status,200);
  assert.equal((await send(first,'/api/session')).status,401);
  const fresh=await login('192.0.2.1');assert.equal((await (await send(fresh,'/api/finance/overview?month=2026-11')).json()).income,650000);
 });
 await t.test('expira e remove registros, projeções, categorias e sessões sem apagar visitante válido',async()=>{
  now=new Date('2026-11-21T14:00:00Z');const active=await login('192.0.2.3');
  now=new Date('2026-11-21T16:00:00Z');
  assert.equal((await send(second,'/api/session')).status,401);
  const expired=await env.DB.prepare('SELECT owner FROM demo_visitors WHERE expires_at<=? LIMIT 1').bind(now.getTime()).first();
  await env.DB.batch([
   env.DB.prepare("INSERT INTO category_terms(owner,phrase_key,category,created_at) VALUES(?,'mercado','Alimentação',?)").bind(expired.owner,now.getTime()),
   env.DB.prepare("INSERT INTO category_memory(owner,description_key,source,category,updated_at) VALUES(?,'mercado','manual','Alimentação',?)").bind(expired.owner,now.getTime()),
   env.DB.prepare('INSERT OR IGNORE INTO cloud_state(owner) VALUES(?)').bind(expired.owner)
  ]);
  const before=(await env.DB.prepare('SELECT COUNT(*) AS n FROM cloud_records').first()).n;
  await env.DB.prepare("CREATE TRIGGER demo_test_cleanup_failure BEFORE DELETE ON web_users BEGIN SELECT RAISE(ABORT,'test failure'); END").run();
  try{
   await assert.rejects(()=>worker.scheduled({},env));
   assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM cloud_records').first()).n,before);
   assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM category_terms').first()).n,1);
  }finally{await env.DB.prepare('DROP TRIGGER demo_test_cleanup_failure').run();}
  await worker.scheduled({},env);
  assert.equal((await send(active,'/api/session')).status,200);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM web_users').first()).n,1);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM demo_visitors').first()).n,1);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM cloud_records').first()).n,5);
  for(const table of ['finance_projection','finance_operations','category_memory','category_record_meta','category_terms','cloud_state'])assert.equal((await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE owner=?`).bind(expired.owner).first()).n,0,table);
 });
 await t.test('falha fechada quando identidade do banco diverge; produção não oferece login demo',async()=>{
  assert.equal((await createWorker().fetch(request('/auth/demo','POST',{}),env)).status,404);
  await env.DB.prepare("UPDATE cloud_meta SET value='123456' WHERE key='bot_id'").run();
  assert.equal((await worker.fetch(request('/auth/demo','POST',{}),env)).status,503);
 });
});
