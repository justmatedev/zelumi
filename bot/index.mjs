import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Store } from './store.mjs';
import { handleUpdate } from './engine.mjs';
import { createTelegram, TelegramError } from './telegram.mjs';

export function config(env) {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || !/^\d+:[A-Za-z0-9_-]+$/.test(token)) throw new Error('Preencha TELEGRAM_BOT_TOKEN no arquivo .env com o token do @BotFather.');
  const timezone = env.BOT_TIMEZONE || 'America/Sao_Paulo';
  try { new Intl.DateTimeFormat('pt-BR', {timeZone:timezone}).format(); }
  catch { throw new Error('BOT_TIMEZONE inválido. Use, por exemplo, America/Sao_Paulo.'); }
  return { token, timezone, path: resolvePath(env.BOT_DB_PATH || './data/zelumi.sqlite') };
}

export async function flushOutbox(store, api) {
  let delivery;
  while ((delivery = store.nextDelivery())) {
    try { await api(delivery.method, delivery.payload); }
    catch (error) {
      if (error instanceof TelegramError && [400,403].includes(error.code)) {
        // Bot bloqueado, botão antigo ou mensagem que não pode mais ser enviada.
        console.warn(`Resposta não entregue (${error.code}); entrega ${delivery.id} descartada.`);
      } else throw error;
    }
    store.delivered(delivery.id);
  }
}

async function main() {
  const settings = config(process.env), store = new Store(settings.path), controller = new AbortController();
  const api = createTelegram(settings.token, { signal: controller.signal });
  const stop = () => controller.abort();
  process.once('SIGINT',stop); process.once('SIGTERM',stop);
  try {
    const me = await api('getMe');
    const botId=store.getMeta('bot_id');
    if(botId && botId!==String(me.id)) throw new Error('Esse banco pertence a outro bot. Use um BOT_DB_PATH diferente.');
    store.setMeta('bot_id',me.id);
    if((await api('getWebhookInfo')).url) throw new Error('Este bot já tem um webhook. Use um bot novo para o teste ou remova o webhook conscientemente antes de usar long polling.');
    await api('setMyCommands',{commands:[
      {command:'ajuda',description:'Como registrar compras e receitas'},
      {command:'hoje',description:'Resumo de hoje'}, {command:'mes',description:'Resumo do mês'},
      {command:'ultimos',description:'Ver e editar os últimos lançamentos'},
      {command:'desfazer',description:'Desfazer o último lançamento'},
      {command:'cancelar',description:'Cancelar pergunta ou edição'}, {command:'id',description:'Mostrar meu ID do Telegram'}
    ]});
    console.log(`Zelumi ativo em @${me.username}. Use Ctrl+C para encerrar.`);
    console.log('Cadastro aberto: usuários Telegram podem começar pela conversa privada.');
    console.log('Dados em SQLite local. Mantenha apenas uma instância do bot em execução.');
    let failures=0;
    while(!controller.signal.aborted) {
      try {
        await flushOutbox(store,api);
        const updates=await api('getUpdates',{offset:store.offset,timeout:25,allowed_updates:['message','callback_query']});
        for(const update of updates) {
          if(controller.signal.aborted) break;
          handleUpdate(store,update,settings);
          await flushOutbox(store,api);
        }
        failures=0;
      } catch(error) {
        if(controller.signal.aborted) break;
        if(!(error instanceof TelegramError) || [401,404,409].includes(error.code)) throw error;
        const seconds=Math.max(Math.min(2**Math.min(++failures,5),30), Number(error.retryAfter)||0);
        console.warn(`${error.message} Nova tentativa em ${seconds}s.`);
        try {await delay(seconds*1000,undefined,{signal:controller.signal});}catch{}
      }
    }
  } finally {
    controller.abort(); store.close();
    process.removeListener('SIGINT',stop); process.removeListener('SIGTERM',stop);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolvePath(process.argv[1])).href) {
  main().catch(error=>{
    // Só os erros conhecidos carregam detalhes seguros para exibir.
    console.error(error instanceof TelegramError ? error.message : error.message?.startsWith('Preencha ') || /^(TELEGRAM_|BOT_TIMEZONE|Esse banco|Este bot)/.test(error.message || '') ? error.message : 'O bot parou por um erro interno. Verifique o banco local e a versão do Node.js.');
    process.exitCode=1;
  });
}
