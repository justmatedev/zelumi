import { randomUUID } from 'node:crypto';
import { parse, resolve, schedule } from '../shared/parser.mjs';

const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl = cents => formatter.format(cents / 100);
const dateFormatters = new Map();
const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const help = `🌱 Sou o Zelumi. Me conte o que entrou ou saiu:

pão 10
uber 23,50
ontem almoço 35
recebi 200 da venda da cadeira
notebook 3000 em 10x
google 1000 x12 → total de R$ 1.000 em 12 parcelas
google 12x 80 → 12 parcelas de R$ 80 (total R$ 960)

/hoje — resumo de hoje
/mes — resumo deste mês
/ultimos — últimos 10 lançamentos
/desfazer — apaga o último lançamento
/cancelar — cancela a pergunta ou edição
/id — seu identificador no Telegram
/ajuda — mostra esta mensagem

Use Editar para substituir a compra inteira pela mensagem completa. Uso regras, não IA. Aceito texto e datas hoje/ontem. /mes usa as parcelas de cada mês; /hoje usa valores integrais pela data da compra. Seus registros são os mesmos do site Zelumi.`;

export function localDate(now, timezone) {
  if (!dateFormatters.has(timezone)) dateFormatters.set(timezone, new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }));
  const parts = Object.fromEntries(dateFormatters.get(timezone).formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function handleUpdate(store, update, { timezone = 'America/Sao_Paulo', now = new Date() } = {}) {
  if (!Number.isSafeInteger(update.update_id)) throw new Error('Update inválido.');
  return store.process(update, () => {
    const callback = update.callback_query;
    const message = callback?.message || update.message;
    const sender = callback?.from || message?.from;
    const ack = text => { if(callback) store.enqueue('answerCallbackQuery', { callback_query_id: callback.id, text }); };
    if (!sender || !message || message.chat?.type !== 'private' || sender.is_bot || !Number.isSafeInteger(sender.id) || sender.id<=0 || message.chat.id!==sender.id) { ack('Use a conversa privada com o bot.'); return; }
    const owner = String(sender.id), chat = message.chat.id;
    const reply = (text, buttons) => store.enqueue('sendMessage', { chat_id: chat, text, ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}) });
    const text = message.text?.trim() || '';
    const command = text.startsWith('/') ? text.split(/[\s@]/)[0].toLowerCase() : '';
    if (!callback && command === '/id') { reply(`Seu ID no Telegram: ${owner}`); return; }
    if (callback) ack();
    const today = localDate(now, timezone);
    const sentAt = !callback && Number.isSafeInteger(message.date) && message.date > 0 ? new Date(message.date * 1000) : now;
    const [y,m,d] = localDate(sentAt, timezone).split('-').map(Number);
    const parserNow = new Date(y,m-1,d,12);
    const pending = store.pending(owner);
    const cancelButtons = token => [[{ text: 'Cancelar', callback_data: `cancel:${token}` }]];
    const recordButtons = id => [[{text:'Editar',callback_data:`edit:${id}`},{text:'Desfazer',callback_data:`undo:${id}`}]];
    function startPending(data) {
      const session = { ...data, token: randomUUID(), expires: now.getTime() + 30 * 60 * 1000 };
      store.setPending(owner, session);
      reply(data.question + '\n\nPara sair, use /cancelar.', cancelButtons(session.token));
    }
    function save(result, editing, dateWasExplicit=false) {
      const {status,question,...record} = result;
      if (editing && !store.record(owner, editing)) { store.clearPending(owner); reply('Esse lançamento já foi desfeito. Envie uma nova mensagem.'); return; }
      if(editing){
        const current=store.record(owner,editing);
        if(!pending?.originalVersion||current.version!==pending.originalVersion){store.clearPending(owner);reply('Esse lançamento mudou desde o início da edição. Abra Editar novamente para revisar. Nada foi substituído.');return;}
        if(!dateWasExplicit&&record.date===pending.originalDate&&record.installments===pending.originalInstallments&&pending.originalStartMonth)record.installmentStartMonth=pending.originalStartMonth;
      }
      record.schedule = schedule(record);
      const id = editing || store.insert(owner, record);
      if(editing) store.replace(owner, id, record);
      store.clearPending(owner);
      reply(`✅ ${editing?'Lançamento atualizado':record.type==='receita'?'Entrada registrada':'Despesa registrada'}\n${record.description} · ${brl(record.amount)}\n${record.category} · ${record.date.split('-').reverse().join('/')}${record.installments>1?`\n${record.installments} parcelas; primeira: ${brl(record.schedule[0].amount)}. Total: ${brl(record.amount)}.`:''}`, recordButtons(id));
    }
    function remove(id) {
      if(!store.remove(owner,id)) { reply('Esse lançamento não está disponível.'); return; }
      if (pending?.editing === id) store.clearPending(owner);
      reply('Lançamento desfeito.');
    }
    if (callback) {
      const [action,id] = (callback.data || '').split(':');
      if(action==='cancel') {
        if(pending?.token === id) {store.clearPending(owner); reply('Lançamento cancelado. Pode enviar outra mensagem.');}
        else reply('Essa pergunta já foi encerrada.');
      } else if (/^(?:[1-9]\d*|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/.test(id || '')) {
        const recordId = /^\d+$/.test(id) ? Number(id) : id;
        const record = store.record(owner, recordId);
        if (!record) {reply('Esse lançamento não está disponível.'); return;}
        if(action==='undo') remove(recordId);
        else if(action==='edit') {
          if(pending && pending.expires > now.getTime()) {reply('Já existe uma pergunta pendente. Responda ou use /cancelar antes de editar.');return;}
          startPending({mode:'edit',editing:recordId,originalVersion:record.version,originalDate:record.date,originalInstallments:record.installments,originalStartMonth:record.installmentStartMonth||null,question:`Envie o lançamento completo para substituir “${record.description}” (${brl(record.amount)}). Ex.: “pão 12,50”. A data anterior será mantida, a menos que você escreva hoje ou ontem. Todas as parcelas serão recalculadas.`});
        }
      }
      return;
    }
    if (['/start','/ajuda','/help'].includes(command)) {reply(help);return;}
    if (command==='/cancelar' || normalize(text)==='cancelar') {store.clearPending(owner);reply('Tudo certo. Nenhum lançamento pendente.');return;}
    if (command==='/desfazer') { const last=store.recent(owner,1)[0]; if(last) remove(last.id);else reply('Você ainda não tem lançamentos.');return; }
    if(command==='/ultimos') {
      const rows=store.recent(owner,10);
      if(!rows.length) reply('Você ainda não tem lançamentos. Experimente “pão 10”.');
      for(const r of rows) reply(`${r.description} · ${brl(r.amount)} · ${r.type}\n${r.date.split('-').reverse().join('/')} · ${r.category}${r.installments>1?` · ${r.installments} parcelas`:''}`,recordButtons(r.id));
      return;
    }
    if (['/hoje','/mes','/resumo'].includes(command) || ['quanto gastei hoje?','quanto gastei hoje','resumo de hoje'].includes(normalize(text))) {
      const monthly=command==='/mes', period=monthly?today.slice(0,7):today;
      const summary=store.summary(owner,period);
      if(summary.status){reply(summary.status==='preparing'?'Seu histórico está sendo preparado. Envie /mes novamente em instantes.':'Um lançamento antigo precisa de revisão. O resumo não foi calculado para evitar um total incompleto.');return;}
      const {income,expense,count}=summary;
      reply(`📊 ${monthly?'Este mês':'Hoje'}\nEntradas: ${brl(income)}\nSaídas: ${brl(expense)}\n${monthly?'Resultado do mês':'Resultado dos lançamentos'}: ${brl(income-expense)}\n${count} ${monthly?'ocorrência(s). Parcelas nos respectivos meses.':'lançamento(s). Valores integrais pela data da compra; /mes distribui as parcelas.'}`);return;
    }
    if(command) {reply('Comando desconhecido. Use /ajuda para ver as opções.');return;}
    if(!text) {reply('Por enquanto, envie texto, como “pão 10”. Áudios e imagens ainda não são interpretados.');return;}
    if(pending && pending.expires <= now.getTime()) {store.clearPending(owner);reply('A pergunta anterior expirou após 30 minutos. Envie novamente a mensagem completa.');return;}
    if(pending?.mode==='amount') {
      const result=resolve(pending.result,text);
      if(result.status==='ready') save(result,pending.editing,pending.dateWasExplicit);
      else reply(result.question,cancelButtons(pending.token));
      return;
    }
    const result=parse(text,parserNow);
    if(pending?.mode==='edit' && !/\b(hoje|ontem)\b/.test(normalize(text))) result.date=pending.originalDate;
    const dateWasExplicit=/\b(hoje|ontem)\b/.test(normalize(text));
    if(result.status==='ready') save(result,pending?.editing,dateWasExplicit);
    else if(['missing_amount','ambiguous'].includes(result.status)) startPending({mode:'amount',result,editing:pending?.editing,originalVersion:pending?.originalVersion,originalDate:pending?.originalDate,originalInstallments:pending?.originalInstallments,originalStartMonth:pending?.originalStartMonth,dateWasExplicit,question:result.question});
    else reply(result.question);
  });
}
