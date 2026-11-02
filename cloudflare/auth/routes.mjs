import {AuthStore} from './store.mjs';
import {verifyTelegramPayload,InvalidTelegramPayload} from './telegram.mjs';
import {randomToken,hashToken,deriveCsrf,constantTimeEqual} from './crypto.mjs';
import {loginNetwork} from './network.mjs';
import {assertBotBinding} from '../bot-binding.mjs';

const LOGIN='__Host-zelumi_login',SESSION='__Host-zelumi_session',WEEK=7*86400000;
const routes=new Map([['/auth/telegram/config','GET'],['/auth/telegram/start','POST'],['/auth/telegram/callback','POST'],['/api/session','GET'],['/api/session/logout','POST']]);
import {HttpError,json,cookie,setCookie,config,body} from './http.mjs';
export async function handleAuth(request,env,{nowMs}) {
 const path=new URL(request.url).pathname;
 if(path==='/api/finance'||path.startsWith('/api/finance/'))return null;
 if(!['/auth','/api'].some(p=>path===p||path.startsWith(p+'/')))return null;
 const method=routes.get(path);if(!method)return json({error:'Rota não encontrada.'},404);
 if(request.method!==method)return json({error:'Método não permitido.'},405,{Allow:method});
 try {
  const origin=config(env),store=new AuthStore(env.DB);
  await assertBotBinding(env);
  if(method==='POST'&&request.headers.get('Origin')!==origin)throw new HttpError(403,'Origem não autorizada.');
  const data=method==='POST'?await body(request):null;
  if(path==='/auth/telegram/config') {
   const botId=env.TELEGRAM_BOT_TOKEN.split(':')[0];
   if(!/^[1-9]\d{0,15}$/.test(botId)||!Number.isSafeInteger(Number(botId)))throw new HttpError(503,'Serviço temporariamente indisponível.');
   return json({botId,botUsername:env.TELEGRAM_BOT_USERNAME});
  }
  if(path==='/auth/telegram/start') {
   if(Object.keys(data).length)throw new HttpError(400,'Corpo inválido.');
   const flow=randomToken(),csrf=randomToken(),previous=cookie(request,LOGIN);
   const network=loginNetwork(request,env);
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
  // Read-only requests must not overwrite a newer login cookie when delayed.
  if(!profile)return json({error:'Sessão encerrada. Entre novamente.'},401,path==='/api/session/logout'?{'Set-Cookie':setCookie(SESSION,'',0)}:{});
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
