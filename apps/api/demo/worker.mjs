// Dedicated public demo entry point. Never imported by the production Worker.
import {randomUUID} from 'node:crypto';
import {handleAuth} from '../src/auth/routes.mjs';
import {handleFinance} from '../src/finance/routes.mjs';
import {body,cookie,HttpError,json,setCookie} from '../src/auth/http.mjs';
import {randomToken,hashToken} from '../src/auth/crypto.mjs';
import {AuthStore} from '../src/auth/store.mjs';

const DAY=86400000;
async function ready(env){
 if(env.DEMO_ENABLED!=='true'||env.TELEGRAM_BOT_TOKEN!=='999001:public_demo_only')throw new Error('Invalid demo configuration');
 const origin=new URL(env.APP_ORIGIN);
 if(origin.protocol!=='https:'||origin.origin!==env.APP_ORIGIN)throw new Error('Invalid demo origin');
 const markers=await env.DB.prepare("SELECT key,value FROM cloud_meta WHERE key IN ('bot_id','public_demo')").all();
 if(!markers.results.some(r=>r.key==='bot_id'&&r.value==='999001')||!markers.results.some(r=>r.key==='public_demo'&&r.value==='1'))throw new Error('Dedicated demo database required');
}
async function startDemo(request,env,now){
 const input=await body(request);
 if(Object.keys(input).length)throw new HttpError(400,'Corpo inválido.');
 // Repeated requests with a live cookie reuse the same visitor, including retries.
 const previous=cookie(request,'__Host-zelumi_session');
 if(previous&&await new AuthStore(env.DB).getSession(await hashToken(previous),now))return json({ok:true});
 const window=Math.floor(now/600000)*600000;
 const network=await hashToken(`${window}:${request.headers.get('CF-Connecting-IP')||'local'}`);
 const limit=await env.DB.prepare(`INSERT INTO web_auth_limits(network_key,window_start,count) VALUES(?,?,1)
  ON CONFLICT(network_key,window_start) DO UPDATE SET count=MIN(count+1,6) RETURNING count`).bind(network,window).first();
 if(limit.count>5)return json({error:'Muitas demonstrações iniciadas. Aguarde alguns minutos.'},429,{'Retry-After':String(Math.ceil((window+600000-now)/1000))});
 const owner=randomUUID(),token=randomToken(),expires=now+DAY;
 const parts=new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(new Date(now));
 const month=parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;
 const examples=[
  ['Salário de exemplo','receita','Receitas',650000,1],
  ['Aluguel de exemplo','despesa','Casa',140000,1],
  ['Mercado de exemplo','despesa','Alimentação',28090,1],
  ['Transporte de exemplo','despesa','Transporte',5000,1],
  ['Notebook de exemplo','despesa','Outros',120000,6]
 ];
 await env.DB.batch([
  env.DB.prepare('INSERT INTO web_users(owner,first_name,created_at,updated_at) VALUES(?,?,?,?)').bind(owner,'Visitante',now,now),
  env.DB.prepare('INSERT INTO demo_visitors(owner,expires_at) VALUES(?,?)').bind(owner,expires),
  ...examples.map(([description,type,category,amount,installments])=>env.DB.prepare('INSERT INTO cloud_records(id,owner,body) VALUES(?,?,?)').bind(randomUUID(),owner,JSON.stringify({description,type,category,amount,installments,date:month+'-01',installmentStartMonth:installments>1?month:null}))),
  env.DB.prepare('INSERT INTO web_sessions(token_hash,owner,created_at,expires_at) VALUES(?,?,?,?)').bind(await hashToken(token),owner,now,expires)
 ]);
 return json({ok:true},200,{'Set-Cookie':setCookie('__Host-zelumi_session',token,DAY/1000)});
}
async function cleanup(db,now){
 const expired=await db.prepare('SELECT owner FROM demo_visitors WHERE expires_at<=? LIMIT 100').bind(now).all();
 if(expired.results.length){
  const owners=expired.results.map(r=>r.owner),placeholders=owners.map(()=>'?').join(',');
  // Fixed table allowlist; the owner list is bound, and each batch is atomic.
  const tables=['web_sessions','cloud_records','finance_projection','finance_operations','category_memory','category_record_meta','category_terms','cloud_state','demo_visitors','web_users'];
  await db.batch(tables.map(table=>db.prepare(`DELETE FROM ${table} WHERE owner IN (${placeholders})`).bind(...owners)));
 }
 await db.prepare('DELETE FROM web_auth_limits WHERE window_start<?').bind(now-600000).run();
}
export function createDemoWorker({clock=()=>new Date()}={}){
 return {
  async fetch(request,env){
   const url=new URL(request.url),path=url.pathname;
   if(url.origin!==env.APP_ORIGIN)return json({error:'Origem não autorizada.'},403);
   if(path.startsWith('/telegram')||path.startsWith('/auth')&&path!=='/auth/demo')return json({error:'Use a demonstração com dados fictícios.'},404);
   if(!path.startsWith('/api')&&path!=='/auth/demo'&&path!=='/health')return env.ASSETS?env.ASSETS.fetch(request):new Response('Not found',{status:404});
   try{
    await ready(env);
    const now=clock().getTime();
    if(path==='/auth/demo'){
     if(request.method!=='POST')return json({error:'Método não permitido.'},405,{Allow:'POST'});
     if(request.headers.get('Origin')!==env.APP_ORIGIN)throw new HttpError(403,'Origem não autorizada.');
     return await startDemo(request,env,now);
    }
    if(path==='/health')return json({service:'zelumi-demo',status:'configured'});
    return await handleAuth(request,env,{nowMs:now})||await handleFinance(request,env,{nowMs:now})||json({error:'Rota não encontrada.'},404);
   }catch(error){return json({error:error instanceof HttpError?error.message:'Demonstração temporariamente indisponível.'},error instanceof HttpError?error.status:503);}
  },
  async scheduled(_event,env){await ready(env);await cleanup(env.DB,clock().getTime());}
 };
}
export default createDemoWorker();
