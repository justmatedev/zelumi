import {AuthStore} from './store.mjs';
import {verifyTelegramPayload,InvalidTelegramPayload} from './telegram.mjs';
import {randomToken,hashToken,deriveCsrf,constantTimeEqual} from './crypto.mjs';

const LOGIN='__Host-zelumi_login',SESSION='__Host-zelumi_session',WEEK=7*86400000;
const routes=new Map([['/auth/telegram/start','POST'],['/auth/telegram/callback','POST'],['/api/session','GET'],['/api/session/logout','POST']]);
class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
function json(data,status=200,extra={}) {
 return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",...extra}});
}
function cookie(request,name) {
 const values=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='));
 if(values.length!==1)return null;
 const value=values[0].slice(name.length+1);return /^[a-f0-9]{64}$/.test(value)?value:null;
}
const setCookie=(name,value,seconds)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
function config(env) {
 const origin=new URL(env.APP_ORIGIN);
 if(origin.origin!==env.APP_ORIGIN||origin.protocol!=='https:'||! /^\w{5,32}$/.test(env.TELEGRAM_BOT_USERNAME||'')||! /^\d+:[A-Za-z0-9_-]+$/.test(env.TELEGRAM_BOT_TOKEN||'')||!env.DB)throw new Error('Invalid configuration');
 return origin.origin;
}
async function body(request) {
 if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new HttpError(400,'Envie JSON.');
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Corpo inválido.');
 const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();throw new HttpError(413,'Corpo muito grande.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const value of chunks){bytes.set(value,offset);offset+=value.length;}
 let data;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new HttpError(400,'JSON inválido.');}
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpError(400,'Corpo inválido.');
 return data;
}
export async function handleAuth(request,env,{nowMs}) {
 const path=new URL(request.url).pathname;
 if(!['/auth','/api'].some(p=>path===p||path.startsWith(p+'/')))return null;
 const method=routes.get(path);if(!method)return json({error:'Rota não encontrada.'},404);
 if(request.method!==method)return json({error:'Método não permitido.'},405,{Allow:method});
 try {
  const origin=config(env),store=new AuthStore(env.DB);
  if(method==='POST'&&request.headers.get('Origin')!==origin)throw new HttpError(403,'Origem não autorizada.');
  const data=method==='POST'?await body(request):null;
  if(path==='/auth/telegram/start') {
   if(Object.keys(data).length)throw new HttpError(400,'Corpo inválido.');
   const flow=randomToken(),csrf=randomToken(),previous=cookie(request,LOGIN);
   const network=request.cf?request.headers.get('CF-Connecting-IP')||'unknown':'local-development';
   const result=await store.startFlow({flowHash:await hashToken(flow),csrfHash:await hashToken(csrf),expiresAt:nowMs+600000,nowMs,networkKey:await deriveCsrf(network,env.TELEGRAM_BOT_TOKEN,'network'),previousFlowHash:previous?await hashToken(previous):null});
   if(!result.allowed)return json({error:'Muitas tentativas. Aguarde alguns minutos.'},429,{'Retry-After':String(result.retryAfter)});
   return json({botUsername:env.TELEGRAM_BOT_USERNAME,csrfToken:csrf},200,{'Set-Cookie':setCookie(LOGIN,flow,600)});
  }
  if(path==='/auth/telegram/callback') {
   if(Object.keys(data).length!==1||!Object.hasOwn(data,'telegram'))throw new HttpError(400,'Corpo inválido.');
   const flow=cookie(request,LOGIN),csrf=request.headers.get('X-CSRF-Token');
   if(!flow||! /^[a-f0-9]{64}$/.test(csrf||''))throw new HttpError(403,'Fluxo de login inválido.');
   const flowHash=await hashToken(flow),csrfHash=await hashToken(csrf),pending=await store.getFlow(flowHash);
   if(!pending||pending.expires_at<=nowMs)throw new HttpError(401,'Login expirado. Tente novamente.');
   if(!constantTimeEqual(csrfHash,pending.csrf_hash))throw new HttpError(403,'Fluxo de login inválido.');
   const profile=await verifyTelegramPayload(data.telegram,{botToken:env.TELEGRAM_BOT_TOKEN,nowMs});
   const session=randomToken();
   const accepted=await store.acceptLogin({flowHash,csrfHash,profile,payloadHash:profile.payloadHash,sessionHash:await hashToken(session),sessionExpiresAt:nowMs+WEEK,nowMs,attemptId:randomToken()});
   if(!accepted)throw new HttpError(401,'Autorização já utilizada. Tente novamente.');
   const response=json({ok:true});response.headers.append('Set-Cookie',setCookie(SESSION,session,WEEK/1000));response.headers.append('Set-Cookie',setCookie(LOGIN,'',0));return response;
  }
  const session=cookie(request,SESSION),hash=session?await hashToken(session):null,profile=hash?await store.getSession(hash,nowMs):null;
  if(!profile)return json({error:'Sessão encerrada. Entre novamente.'},401,{'Set-Cookie':setCookie(SESSION,'',0)});
  const csrf=await deriveCsrf(session,env.TELEGRAM_BOT_TOKEN,'session');
  if(path==='/api/session')return json({user:{firstName:profile.first_name,lastName:profile.last_name,username:profile.username},csrfToken:csrf});
  if(Object.keys(data).length)throw new HttpError(400,'Corpo inválido.');
  if(!constantTimeEqual(request.headers.get('X-CSRF-Token'),csrf))throw new HttpError(403,'Solicitação não autorizada.');
  await store.deleteSession(hash);return json({ok:true},200,{'Set-Cookie':setCookie(SESSION,'',0)});
 } catch(error) {
  if(error instanceof HttpError)return json({error:error.message},error.status);
  if(error instanceof InvalidTelegramPayload)return json({error:error.message},401);
  return json({error:'Serviço temporariamente indisponível. Tente novamente.'},503);
 }
}
