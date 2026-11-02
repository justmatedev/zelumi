import {getSessionContext} from '../auth/session.mjs';
import {json,body,HttpError} from '../auth/http.mjs';
import {constantTimeEqual} from '../auth/crypto.mjs';
import {FinanceError,validMonth,categories} from '../../finance/model.mjs';
import {FinanceStore} from './store.mjs';
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const invalid=()=>{throw new FinanceError('INVALID_REQUEST','Verifique os campos e filtros enviados.');};
function integer(s,min,max,fallback){if(s===null)return fallback;if(!/^\d+$/.test(s))invalid();const n=Number(s);if(!Number.isSafeInteger(n)||n<min||n>max)invalid();return n;}
function params(url,allowed){const q=url.searchParams;for(const k of q.keys())if(!allowed.includes(k)||q.getAll(k).length!==1)invalid();return q;}
export async function handleFinance(request,env,{nowMs}){
 const url=new URL(request.url),path=url.pathname;if(path!=='/api/finance'&&!path.startsWith('/api/finance/'))return null;
 const match=path.match(/^\/api\/finance\/records\/([^/]+)$/),list=path==='/api/finance/entries',overview=path==='/api/finance/overview';
 if(!match&&!list&&!overview)return json({error:'Rota não encontrada.'},404);
 const methods=match?['GET','PUT','DELETE']:['GET'];if(!methods.includes(request.method))return json({error:'Método não permitido.'},405,{Allow:methods.join(', ')});
 try{
  const context=await getSessionContext(request,env,nowMs);if(!context)return json({error:'Sessão encerrada. Entre novamente.'},401);
  const store=new FinanceStore(context.db,context.authorization),owner=context.owner;
  if(match){
   const id=match[1];if(!uuid.test(id)&&! /^[1-9]\d{0,18}$/.test(id))invalid();params(url,[]);
   if(request.method==='GET')return json(await store.detail(owner,id));
   if(request.headers.get('Origin')!==env.APP_ORIGIN||!constantTimeEqual(request.headers.get('X-CSRF-Token'),context.csrfToken))throw new HttpError(403,'Solicitação não autorizada.');
   const input=await body(request),key=request.headers.get('Idempotency-Key');if(!uuid.test(key||''))invalid();
   const allowed=request.method==='PUT'?['expectedVersion','record']:['expectedVersion'];if(Object.keys(input).some(k=>!allowed.includes(k))||! /^[a-f0-9]{64}$/.test(input.expectedVersion||''))invalid();
   return json(await store.mutate({owner,id,kind:request.method,expectedVersion:input.expectedVersion,record:input.record,operationKey:key,nowMs}));
  }
  if(overview){const q=params(url,['month']);if(!validMonth(q.get('month'),9999))invalid();return json(await store.overview(owner,q.get('month')));}
  const q=params(url,['month','q','type','category','parts','page','pageSize','snapshot']);
  if(q.has('month')&&!validMonth(q.get('month'),9999)||q.has('q')&&q.get('q').length>100||q.has('type')&&!['receita','despesa'].includes(q.get('type'))||q.has('category')&&!categories.includes(q.get('category'))||q.has('parts')&&!['all','yes','no'].includes(q.get('parts')))invalid();
  return json(await store.entries(owner,{month:q.get('month'),q:q.get('q'),type:q.get('type'),category:q.get('category'),parts:q.get('parts')||'all',page:integer(q.get('page'),1,1000000,1),pageSize:integer(q.get('pageSize'),1,50,20),snapshot:integer(q.get('snapshot'),0,Number.MAX_SAFE_INTEGER,undefined)}));
 }catch(error){
  if(error instanceof FinanceError||error instanceof HttpError)return json({error:error.message,code:error.code||'INVALID_REQUEST'},error.status,error.code==='HISTORY_PREPARING'?{'Retry-After':'1'}:{});
  return json({error:'Não foi possível acessar seus lançamentos. Tente novamente.',code:'UNAVAILABLE'},503);
 }
}
