// Entry point used exclusively by dev/wrangler.jsonc; never imported by production.
import worker from '../src/worker.mjs';
import {randomToken,hashToken} from '../src/auth/crypto.mjs';
import {json,setCookie,body} from '../src/auth/http.mjs';
import {DEMO_OWNER,LOCAL_ORIGIN,localEnv} from './demo.mjs';
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.hostname!=='127.0.0.1'||url.port!=='8788'||env.APP_ORIGIN!==LOCAL_ORIGIN||env.TELEGRAM_BOT_TOKEN!==localEnv.TELEGRAM_BOT_TOKEN)return json({error:'Ambiente local inválido.'},403);
  if(url.pathname==='/auth/local'){
   if(request.method!=='POST')return json({error:'Método não permitido.'},405,{Allow:'POST'});
   if(request.headers.get('Origin')!==LOCAL_ORIGIN)return json({error:'Origem não autorizada.'},403);
   try{await body(request);}catch{return json({error:'Corpo inválido.'},400);}
   const marker=await env.DB.prepare("SELECT value FROM cloud_meta WHERE key='local_demo_seeded'").first();
   if(!marker)return json({error:'Execute npm run dev para preparar a conta de teste.'},503);
   const token=randomToken(),now=Date.now();
   await env.DB.prepare('INSERT INTO web_sessions VALUES(?,?,?,?)').bind(await hashToken(token),DEMO_OWNER,now,now+7*86400000).run();
   return json({ok:true},200,{'Set-Cookie':setCookie('__Host-zelumi_session',token,7*86400)});
  }
  if(url.pathname.startsWith('/auth/')||url.pathname==='/telegram/webhook')return json({error:'Use a conta de teste local.'},404);
  return worker.fetch(request,env);
 }
};
