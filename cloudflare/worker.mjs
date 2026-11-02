import { timingSafeEqual } from 'node:crypto';
import { handleUpdate } from '../bot/engine.mjs';
import { createTelegram } from '../bot/telegram.mjs';
import { D1Store } from './store.mjs';
import { deliver } from './outbox.mjs';
import {handleAuth} from './auth/routes.mjs';
import {cleanupAuth} from './auth/store.mjs';
import {handleFinance} from './finance/routes.mjs';
import {cleanupFinance} from './finance/store.mjs';
import {assertBotBinding} from './bot-binding.mjs';

function settings(env) {
  if(!/^\d+:[A-Za-z0-9_-]+$/.test(env.TELEGRAM_BOT_TOKEN||''))throw new Error('Token ausente.');
  if(!/^[A-Za-z0-9_-]{32,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET||''))throw new Error('Segredo ausente.');
  const timezone=env.BOT_TIMEZONE||'America/Sao_Paulo';
  new Intl.DateTimeFormat('pt-BR',{timeZone:timezone});
  if(!env.DB)throw new Error('D1 ausente.');
  return {timezone,botId:env.TELEGRAM_BOT_TOKEN.split(':')[0]};
}
function authorized(request,expected) {
  const given=request.headers.get('X-Telegram-Bot-Api-Secret-Token')||'';
  const left=Buffer.from(given),right=Buffer.from(expected);
  return left.length===right.length&&timingSafeEqual(left,right);
}
async function readUpdate(request) {
  const reader=request.body?.getReader();if(!reader)throw new Error('Corpo ausente.');
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw new Error('Corpo grande.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let position=0;for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.byteLength;}
  const update=JSON.parse(new TextDecoder().decode(bytes));
  if(!update||!Number.isSafeInteger(update.update_id)||update.update_id<0)throw new Error('Update inválido.');
  const m=update.callback_query?.message||update.message;
  if(m?.text!==undefined&&typeof m.text!=='string')throw new Error('Texto inválido.');
  return update;
}
export function createWorker({apiFactory=createTelegram,clock=()=>new Date()}={}) {
  return {
    async fetch(request,env) {
      const path=new URL(request.url).pathname;
      const auth=await handleAuth(request,env,{nowMs:clock().getTime()});
      if(auth)return auth;
      const finance=await handleFinance(request,env,{nowMs:clock().getTime()});if(finance)return finance;
      if(path==='/health'&&request.method==='GET') {
        try {settings(env);await assertBotBinding(env);return Response.json({service:'zelumi-bot',status:'configured'});}
        catch {return Response.json({service:'zelumi-bot',status:'not_configured'},{status:503});}
      }
      if(path!=='/telegram/webhook')return env.ASSETS?env.ASSETS.fetch(request):new Response('Not found',{status:404});
      if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers:{Allow:'POST'}});
      let config;
      try{config=settings(env);}catch{return new Response('Service not configured',{status:503});}
      if(!authorized(request,env.TELEGRAM_WEBHOOK_SECRET))return new Response('Unauthorized',{status:401});
      let update;
      try{update=await readUpdate(request);}catch{return new Response('Invalid update',{status:400});}
      // Não há operações financeiras em grupos, canais ou updates sem mensagem.
      const message=update.callback_query?.message||update.message;
      if(!message||message.chat?.type!=='private')return new Response('OK');
      try{
        const now=clock(),store=new D1Store(env.DB,{...config,now});
        await handleUpdate(store,update,{...config,now});
        // Só devolve 200 depois do commit. Em erro no D1 o Telegram deve reenviar.
        // A fila persistente permite confirmar o webhook mesmo com Telegram fora.
        await deliver(env.DB,apiFactory(env.TELEGRAM_BOT_TOKEN),{now:now.getTime(),updateId:update.update_id,botId:config.botId});
        return new Response('OK');
      }catch{
        // Não registrar corpo das mensagens, token ou URLs de API.
        console.error('Falha no processamento do webhook; aguardando nova tentativa.');
        return new Response('Please retry',{status:503});
      }
    },
    async scheduled(_event,env) {
      try{
        const config=settings(env);
        await deliver(env.DB,apiFactory(env.TELEGRAM_BOT_TOKEN),{now:clock().getTime(),botId:config.botId});
        // Mantém deduplicação por 7 dias (a fila de entrada Telegram dura até 24h).
        await env.DB.prepare('DELETE FROM cloud_processed WHERE created_at<?').bind(clock().getTime()-7*86400000).run();
      }catch{console.error('Falha ao reenviar respostas pendentes.');}
      try{if(env.DB)await cleanupAuth(env.DB,clock().getTime());}
      catch{console.error('Falha na limpeza de sessões.');}
      try{if(env.DB)await cleanupFinance(env.DB,clock().getTime());}catch{console.error('Falha na limpeza de operações.');}
    }
  };
}
export default createWorker();
