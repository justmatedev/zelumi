import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {migrate} from './helpers/d1.mjs';
import {createWorker} from '../apps/api/src/worker.mjs';
import localWorker from '../apps/api/dev/worker.mjs';
import {seedDemo,localEnv,LOCAL_ORIGIN} from '../apps/api/dev/demo.mjs';
process.env.WRANGLER_LOG_PATH=resolve('.wrangler/logs');
process.env.WRANGLER_SEND_METRICS='false';
const {getPlatformProxy}=await import('wrangler');
test('ambiente local usa sessões e API reais em banco de demonstração',async t=>{
 const p=await getPlatformProxy({configPath:'tests/wrangler.jsonc',persist:false,remoteBindings:false,envFiles:[]});t.after(()=>p.dispose());
 const env={...localEnv,DB:p.env.DB};await migrate(env.DB);
 await seedDemo(env.DB,new Date('2026-11-02T15:00:00Z'));
 const request=(path,method='GET',body,headers={})=>new Request('http://127.0.0.1:8788'+path,{method,headers:{Origin:LOCAL_ORIGIN,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 await t.test('login local rejeita origem externa, host externo e método GET',async()=>{
  assert.equal((await localWorker.fetch(request('/auth/local','POST',{}, {Origin:'https://evil.example'}),env)).status,403);
  assert.equal((await localWorker.fetch(request('/auth/local'),env)).status,405);
  assert.equal((await localWorker.fetch(new Request('https://public.example/auth/local',{method:'POST',headers:{Origin:LOCAL_ORIGIN}}),env)).status,403);
 });
 await t.test('API de desenvolvimento fica pronta para o launcher',async()=>{
  const health=await localWorker.fetch(request('/health'),env);assert.equal(health.status,200);
  assert.equal((await health.json()).service,'zelumi-bot');
 });
 let cookie,csrf;
 await t.test('login cria cookie seguro e uma sessão aceita pela API financeira',async()=>{
  const login=await localWorker.fetch(request('/auth/local','POST',{}),env);assert.equal(login.status,200);
  const header=login.headers.get('set-cookie');assert.match(header,/Secure; HttpOnly; SameSite=Lax/);cookie=header.split(';')[0];
  const session=await localWorker.fetch(request('/api/session','GET',undefined,{Cookie:cookie}),env);assert.equal(session.status,200);
  const data=await session.json();assert.equal(data.user.firstName,'Conta de teste');csrf=data.csrfToken;
  const overview=await localWorker.fetch(request('/api/finance/overview?month=2026-11','GET',undefined,{Cookie:cookie}),env);
  assert.equal(overview.status,200);const month=await overview.json();assert.equal(month.income,650000);assert.equal(month.expense,193090);
 });
 await t.test('edição e exclusão persistem e seed não recria registros removidos',async()=>{
  const send=(path,method='GET',body)=>localWorker.fetch(request(path,method,body,{Cookie:cookie,'X-CSRF-Token':csrf,'Idempotency-Key':randomUUID()}),env);
  const path='/api/finance/records/90000001';const detail=await (await send(path)).json();
  const {id,version,schedule,categoryMemory,categorySource,...record}=detail;
  assert.equal((await send(path,'PUT',{expectedVersion:version,record:{...record,amount:700000}})).status,200);
  const latest=await (await send(path)).json();assert.equal(latest.amount,700000);
  assert.equal((await send(path,'DELETE',{expectedVersion:latest.version})).status,200);
  await seedDemo(env.DB,new Date('2026-11-02T15:00:00Z'));
  assert.equal((await send(path)).status,404);
 });
 await t.test('logout revoga sessão e entrada publicada não oferece login local',async()=>{
  assert.equal((await localWorker.fetch(request('/api/session/logout','POST',{}, {Cookie:cookie,'X-CSRF-Token':csrf}),env)).status,200);
  assert.equal((await localWorker.fetch(request('/api/session','GET',undefined,{Cookie:cookie}),env)).status,401);
  assert.equal((await createWorker().fetch(request('/auth/local','POST',{}),env)).status,404);
 });
});
