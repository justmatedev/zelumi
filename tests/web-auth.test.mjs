import {migrate} from './helpers/d1.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash,createHmac} from 'node:crypto';
import {createWorker} from '../cloudflare/worker.mjs';

process.env.WRANGLER_LOG_PATH=resolve('.wrangler/logs');
process.env.WRANGLER_SEND_METRICS='false';
const {getPlatformProxy}=await import('wrangler');
const origin='https://test.workers.dev',token='123:fake',initial=1793617200000;
const sign=(fields)=>({...fields,hash:createHmac('sha256',createHash('sha256').update(token).digest()).update(Object.keys(fields).sort().map(k=>`${k}=${fields[k]}`).join('\n')).digest('hex')});
const payload=(id=11,extra={})=>sign({id,first_name:'João <>&',auth_date:initial/1000,...extra});
const cookie=(res,name)=>res.headers.getSetCookie().find(v=>v.startsWith(`${name}=`))?.split(';')[0];

test('sessões web com D1 local',async t=>{
 const platform=await getPlatformProxy({configPath:'tests/wrangler.jsonc',persist:false,remoteBindings:false,envFiles:[resolve('.dev.vars.example')]});t.after(()=>platform.dispose());
 const db=platform.env.DB;
 await migrate(db);
 let now=initial;
 const env={DB:db,TELEGRAM_BOT_TOKEN:token,TELEGRAM_WEBHOOK_SECRET:'local_test_secret_with_at_least_32_characters',APP_ORIGIN:origin,TELEGRAM_BOT_USERNAME:'test_bot'};
 const worker=createWorker({clock:()=>new Date(now),apiFactory:()=>async()=>true});
 const req=(path,body,options={})=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...options.headers},...(body===undefined?{}:{body:JSON.stringify(body)}),...options, ...(options.headers?{headers:{Origin:origin,'Content-Type':'application/json',...options.headers}}:{})});
 const send=(path,body,options)=>worker.fetch(req(path,body,options),env);
 const count=async table=>(await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first()).n;
 async function start(previous){const res=await send('/auth/telegram/start',{},previous?{headers:{Cookie:previous}}:undefined);assert.equal(res.status,200);return {cookie:cookie(res,'__Host-zelumi_login'),csrf:(await res.json()).csrfToken,res};}
 const callback=(flow,p=payload(),extra={})=>send('/auth/telegram/callback',{telegram:p},{headers:{Cookie:flow.cookie,'X-CSRF-Token':flow.csrf,...extra}});
 const reset=async()=>{for(const table of ['web_sessions','web_users','web_auth_accepts','web_auth_flows','web_auth_limits'])await db.prepare(`DELETE FROM ${table}`).run();now=initial;};
 await t.test('login real cria perfil, cookie protegido, sessão e logout revogável',async()=>{
  const flow=await start();assert.match(flow.res.headers.get('set-cookie'),/Secure/);assert.match(flow.res.headers.get('set-cookie'),/HttpOnly/);
  const accepted=await callback(flow);assert.equal(accepted.status,200);assert.deepEqual(await accepted.json(),{ok:true});
  const session=cookie(accepted,'__Host-zelumi_session');assert.ok(session);assert.match(accepted.headers.getSetCookie().join(' '),/SameSite=Lax/);assert.doesNotMatch(accepted.headers.getSetCookie().join(' '),/Domain=/i);
  const info=await send('/api/session',undefined,{headers:{Cookie:session}});assert.equal(info.status,200);assert.equal(info.headers.get('cache-control'),'no-store');
  const data=await info.json();assert.deepEqual(data.user,{firstName:'João <>&',lastName:null,username:null});assert.ok(data.csrfToken);assert.ok(!JSON.stringify(data).includes(session.split('=')[1]));
  const row=await db.prepare('SELECT * FROM web_sessions').first();assert.notEqual(row.token_hash,session.split('=')[1]);assert.equal(row.owner,'11');
  assert.equal((await send('/api/session/logout',{}, {headers:{Cookie:session,'X-CSRF-Token':'wrong'}})).status,403);
  const out=await send('/api/session/logout',{}, {headers:{Cookie:session,'X-CSRF-Token':data.csrfToken}});assert.equal(out.status,200);
  assert.equal((await send('/api/session',undefined,{headers:{Cookie:session}})).status,401);
  assert.equal((await send('/api/session/logout',{}, {headers:{Cookie:session,'X-CSRF-Token':data.csrfToken}})).status,401);
 });
 await t.test('rejeita CSRF, origem, método e corpo excessivo antes de autenticar',async()=>{
  await reset();const f=await start();
  assert.equal((await callback(f,payload(),{Origin:'https://evil.example'})).status,403);
  assert.equal((await callback(f,payload(),{'X-CSRF-Token':''})).status,403);
  assert.equal((await callback({...f,cookie:''})).status,403);
  assert.equal((await send('/auth/telegram/start',{}, {headers:{Origin:''}})).status,403);
  assert.equal((await send('/auth/telegram/callback')).status,405);
  assert.equal((await send('/auth/telegram/start',{}, {headers:{'Content-Type':'text/plain'}})).status,400);
  assert.equal((await send('/auth/telegram/start',{x:'x'.repeat(16384)})).status,413);
  assert.equal(await count('web_users'),0);assert.equal(await count('web_sessions'),0);
 });
 await t.test('callbacks concorrentes e replay entre fluxos criam só uma sessão',async()=>{
  await reset();const f=await start();const results=await Promise.all([callback(f),callback(f)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);assert.equal(await count('web_sessions'),1);
  assert.equal((await callback(await start())).status,401);assert.equal(await count('web_sessions'),1);
 });
 await t.test('fluxo velho não autentica nem apaga o cookie de outra aba',async()=>{
  await reset();const old=await start(),fresh=await start(old.cookie);
  const stale=await callback(old);assert.equal(stale.status,401);assert.equal(stale.headers.get('set-cookie'),null);
  assert.equal((await callback(fresh)).status,200);
 });
 await t.test('expiração e assinaturas inválidas não criam conta ou sessão',async()=>{
  await reset();const f=await start();
  assert.equal((await callback(f,{...payload(),first_name:'alterado'})).status,401);
  now+=601000;assert.equal((await callback(f,payload(11,{auth_date:Math.floor(now/1000)}))).status,401);assert.equal(await count('web_users'),0);
  await reset();const accepted=await callback(await start());const session=cookie(accepted,'__Host-zelumi_session');now+=7*86400000;
  assert.equal((await send('/api/session',undefined,{headers:{Cookie:session}})).status,401);
 });
 await t.test('rate limit é atômico, quinta aceita, sexta bloqueada e janela seguinte libera',async()=>{
  await reset();for(let i=0;i<5;i++)await start();const blocked=await send('/auth/telegram/start',{});assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get('retry-after'))>0);
  now+=600000;await start();
 });
 await t.test('proxy autenticado separa visitantes que compartilham o IP de saída da Vercel',async()=>{
  await reset();
  const proxySecret='a'.repeat(64),proxyEnv={...env,VERCEL_PROXY_SECRET:proxySecret};
  const attempt=ip=>{
   const request=req('/auth/telegram/start',{}, {headers:{'CF-Connecting-IP':'192.0.2.10','X-Real-IP':ip,'X-Zelumi-Proxy-Secret':proxySecret}});
   Object.defineProperty(request,'cf',{value:{}});
   return worker.fetch(request,proxyEnv);
  };
  for(let i=0;i<5;i++)assert.equal((await attempt('203.0.113.1')).status,200);
  assert.equal((await attempt('203.0.113.1')).status,429);
  assert.equal((await attempt('203.0.113.2')).status,200);
 });
 await t.test('cabeçalho de visitante forjado ou inválido não contorna o limite do IP direto',async()=>{
  await reset();
  const proxySecret='a'.repeat(64),proxyEnv={...env,VERCEL_PROXY_SECRET:proxySecret};
  async function attempt(ip,secret){
   const request=req('/auth/telegram/start',{}, {headers:{'CF-Connecting-IP':'192.0.2.10','X-Real-IP':ip,'X-Zelumi-Proxy-Secret':secret}});
   Object.defineProperty(request,'cf',{value:{}});
   return worker.fetch(request,proxyEnv);
  }
  for(let i=0;i<5;i++)assert.equal((await attempt(`203.0.113.${i+1}`,'wrong')).status,200);
  assert.equal((await attempt('203.0.113.99','')).status,429);
  assert.equal((await attempt('not-an-ip',proxySecret)).status,429);
 });
 await t.test('origem Vercel mantém cookies, sessão e logout quando o destino é outro host',async()=>{
  await reset();
  const site='https://usezelumi.vercel.app',proxyEnv={...env,APP_ORIGIN:site};
  const through=(path,data,headers={})=>worker.fetch(new Request('https://backend.workers.dev'+path,{method:data===undefined?'GET':'POST',headers:{Origin:site,'Content-Type':'application/json',...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),proxyEnv);
  const begin=await through('/auth/telegram/start',{});assert.equal(begin.status,200);
  const loginCookie=cookie(begin,'__Host-zelumi_login'),csrf=(await begin.json()).csrfToken;
  const accepted=await through('/auth/telegram/callback',{telegram:payload()},{Cookie:loginCookie,'X-CSRF-Token':csrf});assert.equal(accepted.status,200);
  assert.equal(accepted.headers.getSetCookie().length,2);assert.doesNotMatch(accepted.headers.getSetCookie().join(' '),/Domain=/i);
  const session=cookie(accepted,'__Host-zelumi_session');
  const info=await through('/api/session',undefined,{Cookie:session});assert.equal(info.status,200);assert.equal(info.headers.get('cache-control'),'no-store');
  const sessionCsrf=(await info.json()).csrfToken;
  assert.equal((await through('/api/session/logout',{}, {Cookie:session,'X-CSRF-Token':sessionCsrf,Origin:'https://preview.vercel.app'})).status,403);
  assert.equal((await through('/api/session/logout',{}, {Cookie:session,'X-CSRF-Token':sessionCsrf})).status,200);
  assert.equal((await through('/api/session',undefined,{Cookie:session})).status,401);
 });
 await t.test('mesmo ID reutiliza perfil; outro ID e mesmo nome são outra conta',async()=>{
  await reset();await db.prepare("INSERT INTO cloud_records(id,owner,body) VALUES('existing','11',?)").bind(JSON.stringify({date:'2026-11-02',type:'despesa',amount:1000})).run();
  await callback(await start());await callback(await start(),payload(22));await callback(await start(),payload(11,{username:'novo'}));
  assert.equal(await count('web_users'),2);assert.equal((await db.prepare("SELECT username FROM web_users WHERE owner='11'").first()).username,'novo');
  assert.equal((await db.prepare("SELECT owner FROM cloud_records WHERE id='existing'").first()).owner,'11');
 });
 await t.test('cookie duplicado e owner externo não substituem sessão autenticada',async()=>{
  await reset();const ok=await callback(await start());const session=cookie(ok,'__Host-zelumi_session');
  assert.equal((await send('/api/session',undefined,{headers:{Cookie:`${session}; ${session}`}})).status,401);
  const body=await (await send('/api/session?owner=22',undefined,{headers:{Cookie:session}})).json();assert.equal(body.user.firstName,'João <>&');assert.equal(await count('web_users'),1);
 });
 await t.test('D1 indisponível é 503, configuração de auth não interfere na saúde do bot',async()=>{
  const bad={...env,DB:{prepare(){throw new Error('internal private detail');}}};
  const result=await worker.fetch(req('/auth/telegram/start',{}),bad);assert.equal(result.status,503);assert.doesNotMatch(await result.text(),/internal private/);
  assert.equal((await worker.fetch(req('/auth/telegram/start',{}),{...env,APP_ORIGIN:''})).status,503);
  assert.equal((await worker.fetch(req('/health'),{...env,APP_ORIGIN:''})).status,200);
 });
 await t.test('falha na gravação da sessão reverte perfil, recibo e consumo do fluxo',async()=>{
  await reset();const f=await start();
  await db.prepare("CREATE TRIGGER fail_session BEFORE INSERT ON web_sessions BEGIN SELECT RAISE(ABORT,'test rollback'); END").run();
  try {assert.equal((await callback(f)).status,503);assert.equal(await count('web_users'),0);assert.equal(await count('web_auth_accepts'),0);assert.equal(await count('web_auth_flows'),1);}
  finally{await db.prepare('DROP TRIGGER fail_session').run();}
  assert.equal((await callback(f)).status,200);
 });
 await t.test('falha da limpeza de auth não interrompe reenvio do bot',async()=>{
  await db.prepare("INSERT OR IGNORE INTO cloud_meta VALUES('bot_id','123')").run();
  await db.prepare("INSERT INTO cloud_outbox(update_id,method,payload) VALUES(999,'sendMessage','{}')").run();
  let sent=0;
  const isolated=createWorker({clock:()=>new Date(now),apiFactory:()=>async()=>{sent++;return true;}});
  const unavailable={prepare(sql){if(sql.includes('web_'))throw new Error('Auth unavailable');return db.prepare(sql);},batch:q=>db.batch(q)};
  await isolated.scheduled({}, {...env,DB:unavailable});assert.equal(sent,1);
 });
 await t.test('assets são servidos sem esconder erros da API ou alterar o webhook',async()=>{
  const assets={fetch:async r=>new Response(new URL(r.url).pathname==='/'?'Zelumi':'Not found',{status:new URL(r.url).pathname==='/'?200:404})};
  const webEnv={...env,ASSETS:assets};
  assert.equal((await worker.fetch(req('/'),webEnv)).status,200);
  for(const path of ['/api','/auth','/api/desconhecida']){const r=await worker.fetch(req(path),webEnv);assert.equal(r.status,404);assert.match(r.headers.get('content-type'),/application\/json/);}
  assert.equal((await worker.fetch(req('/pagina-inexistente'),webEnv)).status,404);
  assert.equal((await worker.fetch(req('/telegram/webhook',{}),webEnv)).status,401);
  assert.equal((await worker.fetch(req('/health'),webEnv)).status,200);
 });
 await t.test('401 antigo de consulta não apaga cookie emitido por login posterior',async()=>{
  await reset();const delayed=await send('/api/session');assert.equal(delayed.status,401);
  const accepted=await callback(await start());const session=cookie(accepted,'__Host-zelumi_session');
  // Browser delivers this old response after the callback set its new cookie.
  assert.equal(delayed.headers.get('set-cookie'),null);
  assert.equal((await send('/api/session',undefined,{headers:{Cookie:session}})).status,200);
 });
});
