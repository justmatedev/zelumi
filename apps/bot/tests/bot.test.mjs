import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Store } from '../src/store.mjs';
import { handleUpdate, localDate } from '@zelumi/bot-core/engine';
import { config, flushOutbox } from '../src/index.mjs';
import { createTelegram, TelegramError } from '@zelumi/bot-core/telegram';

const now = new Date('2026-11-02T01:30:00Z'); // Ainda 01/11 em São Paulo.
const options = {now,timezone:'America/Sao_Paulo'};
const message = (id,text,user=11,type='private') => ({update_id:id,message:{message_id:id,from:{id:user},chat:{id:user,type},text}});
const callback = (id,data,user=11) => ({update_id:id,callback_query:{id:`q${id}`,data,from:{id:user},message:{message_id:id,chat:{id:user,type:'private'}}}});
const drain = store => {const results=[];let delivery;while((delivery=store.nextDelivery())){results.push(delivery);store.delivered(delivery.id);}return results;};
function fixture(t) {const store=new Store(':memory:');t.after(()=>store.close());return store;}

test('registra modelo e data explícita nas mensagens do exemplo',t=>{
 const store=fixture(t);
 handleUpdate(store,message(1,'video game xbox 360 1500'),options);
 handleUpdate(store,message(2,'sorvete 7 04/04/2026'),options);
 const rows=store.list('11');assert.equal(rows.length,2);
 assert.equal(rows[0].description,'Video game xbox 360');assert.equal(rows[0].amount,150000);
 assert.equal(rows[1].date,'2026-04-04');assert.equal(rows[1].amount,700);
 assert.equal(store.pending('11'),null);
 assert.match(drain(store).at(-1).payload.text,/04\/04\/2026/);
});
test('edição aplica data numérica e mantém a escolha durante pergunta de valor',t=>{
 const store=fixture(t);
 handleUpdate(store,message(1,'notebook 1200 em 12x'),options);
 const r=store.list('11')[0];
 const body=JSON.parse(store.db.prepare('SELECT body FROM records WHERE id=?').get(r.id).body);
 store.replace('11',r.id,{...body,installmentStartMonth:'2027-02'});
 handleUpdate(store,callback(2,`edit:${r.id}`),options);
 handleUpdate(store,message(3,'notebook 2400 em 12x 04/04/2026'),options);
 assert.equal(store.list('11')[0].date,'2026-04-04');
 assert.equal(store.list('11')[0].schedule[0].date,'2026-04-04');
 handleUpdate(store,callback(4,`edit:${r.id}`),options);
 handleUpdate(store,message(5,'notebook 05/04/2026'),options);
 handleUpdate(store,message(6,'1500'),options);
 assert.equal(store.list('11')[0].date,'2026-04-05');
 assert.equal(store.list('11')[0].amount,150000);
});

test('salva despesa uma única vez e mantém cursor',t=>{
 const store=fixture(t),update=message(1,'pão 10');
 assert.equal(handleUpdate(store,update,options),true);
 assert.equal(handleUpdate(store,update,options),false);
 assert.equal(store.list('11').length,1);
 assert.equal(store.list('11')[0].amount,1000);
 assert.equal(store.list('11')[0].date,'2026-11-01');
 assert.equal(store.offset,2);assert.equal(drain(store).length,1);
});
test('pergunta, valida resposta e registra só quando há valor',t=>{
 const store=fixture(t);
 handleUpdate(store,message(1,'pão'),options);assert.equal(store.list('11').length,0);
 handleUpdate(store,message(2,'não sei'),options);assert.ok(store.pending('11'));
 handleUpdate(store,message(3,'10,50'),options);
 assert.equal(store.list('11')[0].amount,1050);assert.equal(store.pending('11'),null);
});
test('categoriza mensagens novas, mantém categoria ao pedir valor e recalcula na edição',t=>{
 const store=fixture(t);
 handleUpdate(store,message(1,'Netflix'),options);
 handleUpdate(store,message(2,'50'),options);
 assert.equal(store.list('11')[0].category,'Assinaturas');
 assert.match(drain(store).at(-1).payload.text,/Assinaturas/);
 handleUpdate(store,callback(3,'edit:1'),options);
 handleUpdate(store,message(4,'veterinário 80'),options);
 assert.equal(store.list('11').length,1);assert.equal(store.list('11')[0].category,'Pets');
});
test('aceita usuários novos, isola registros e ignora grupos',t=>{
 const store=fixture(t);
 handleUpdate(store,message(1,'pão 10',33),options);
 handleUpdate(store,message(2,'pão 10',11,'group'),options);
 assert.equal(store.list('33').length,1);assert.equal(store.list('11').length,0);
 handleUpdate(store,message(3,'pão 10'),options);
 handleUpdate(store,callback(4,'undo:1',22),options);
 handleUpdate(store,callback(5,'edit:1',22),options);
 assert.equal(store.list('11').length,1);assert.equal(store.pending('22'),null);
 handleUpdate(store,message(6,'/hoje',22),options);
 assert.match(drain(store).at(-1).payload.text,/Saídas: R\$\s*0,00/);
});
test('ajuda e início oferecem o painel sem encerrar uma compra pendente',t=>{
 const store=fixture(t);
 handleUpdate(store,message(1,'pão'),options);drain(store);
 const pending=store.pending('11');
 for(const [i,command] of ['/ajuda','/help','/start'].entries()){
  handleUpdate(store,message(i+2,command),options);
  const replies=drain(store);assert.equal(replies.length,1);
  assert.equal(replies[0].method,'sendMessage');
  assert.match(replies[0].payload.text,/https:\/\/usezelumi\.vercel\.app/);
  assert.deepEqual(replies[0].payload.reply_markup.inline_keyboard,[[{text:'Abrir meu painel',url:'https://usezelumi.vercel.app'}]]);
  assert.deepEqual(store.pending('11'),pending);assert.equal(store.list('11').length,0);
 }
 handleUpdate(store,message(5,'10'),options);assert.equal(store.list('11')[0].amount,1000);
});
test('/id informa a identidade sem exigir liberação ou criar lançamentos',t=>{
 const store=fixture(t);
 handleUpdate(store,message(1,'/id',33),options);
 const text=drain(store)[0].payload.text;
 assert.match(text,/33/);assert.doesNotMatch(text,/liberar|ALLOWED_USER|responsável/);
 assert.equal(store.list('33').length,0);
});
test('editar substitui sem duplicar e preserva a data',t=>{
 const store=fixture(t);
 handleUpdate(store,message(1,'ontem pão 10'),options);
 handleUpdate(store,callback(2,'edit:1'),options);
 handleUpdate(store,message(3,'pão 12,50'),options);
 assert.equal(store.list('11').length,1);assert.equal(store.list('11')[0].amount,1250);
 assert.equal(store.list('11')[0].date,'2026-10-31');
 handleUpdate(store,callback(4,'edit:1'),options);
 handleUpdate(store,message(5,'hoje pão'),options);
 handleUpdate(store,message(6,'15'),options);
 assert.equal(store.list('11')[0].date,'2026-11-01');
 assert.equal(store.list('11')[0].amount,1500);
});
test('desfazer é restrito ao dono e botões antigos são inofensivos',t=>{
 const store=fixture(t);
 handleUpdate(store,message(1,'pão 10'),options);
 handleUpdate(store,callback(2,'undo:1'),options);
 handleUpdate(store,callback(3,'undo:1'),options);
 assert.equal(store.list('11').length,0);
 assert.equal(drain(store).filter(d=>d.method==='answerCallbackQuery').length,2);
});
test('cancelamento antigo não cancela nova pergunta e sessão expira',t=>{
 const store=fixture(t);
 handleUpdate(store,message(1,'pão'),options);const old=store.pending('11').token;
 handleUpdate(store,message(2,'/cancelar'),options);
 handleUpdate(store,message(3,'uber'),options);const current=store.pending('11').token;
 handleUpdate(store,callback(4,`cancel:${old}`),options);
 assert.equal(store.pending('11').token,current);
 handleUpdate(store,message(5,'10'),{...options,now:new Date(now.getTime()+31*60*1000)});
 assert.equal(store.list('11').length,0);assert.equal(store.pending('11'),null);
});
test('resumo mensal usa parcelas e mantém total no cronograma',t=>{
 const store=fixture(t);
 handleUpdate(store,message(1,'recebi 200 da venda da cadeira'),options);
 handleUpdate(store,message(2,'notebook 3000 em 10x'),options);
 handleUpdate(store,message(3,'ontem pão 10'),options);
 handleUpdate(store,message(4,'/mes'),options);
 const text=drain(store).at(-1).payload.text;
 assert.match(text,/Entradas: R\$\s*200,00/);assert.match(text,/Saídas: R\$\s*300,00/);assert.match(text,/Resultado do mês/);
 const record=store.list('11')[1];assert.equal(record.schedule.length,10);
 assert.equal(record.schedule.reduce((s,r)=>s+r.amount,0),300000);
});
test('edição pendente detecta alteração externa, inclusive quando falta valor',t=>{
 const store=fixture(t);handleUpdate(store,message(1,'notebook 1200 em 12x'),options);
 const r=store.list('11')[0];handleUpdate(store,callback(2,`edit:${r.id}`),options);handleUpdate(store,message(3,'notebook'),options);
 const body=JSON.parse(store.db.prepare('SELECT body FROM records WHERE id=?').get(r.id).body);store.replace('11',r.id,{...body,description:'Corrigido no site'});
 handleUpdate(store,message(4,'1300'),options);assert.equal(store.list('11').length,1);assert.equal(store.list('11')[0].description,'Corrigido no site');assert.match(drain(store).at(-1).payload.text,/mudou desde/);
});
test('editar mantém início ajustado e data explícita redefine o mês',t=>{
 const store=fixture(t);handleUpdate(store,message(1,'notebook 1200 em 12x'),options);const r=store.list('11')[0];
 const body=JSON.parse(store.db.prepare('SELECT body FROM records WHERE id=?').get(r.id).body);store.replace('11',r.id,{...body,installmentStartMonth:'2027-02'});
 handleUpdate(store,callback(2,`edit:${r.id}`),options);handleUpdate(store,message(3,'notebook 2400 em 12x'),options);assert.equal(store.list('11')[0].schedule[0].date.slice(0,7),'2027-02');
 handleUpdate(store,callback(4,`edit:${r.id}`),options);handleUpdate(store,message(5,'hoje notebook 3600 em 12x'),options);assert.equal(store.list('11')[0].installmentStartMonth,undefined);
});
test('dados, perguntas e cursor sobrevivem a reinício',()=>{
 const dir=mkdtempSync(join(tmpdir(),'zelumi-test-')),path=join(dir,'bot.sqlite');
 let store;
 try{
   store=new Store(path);handleUpdate(store,message(1,'pão 10'),options);handleUpdate(store,message(2,'uber'),options);store.close();
   store=new Store(path);assert.equal(store.offset,3);assert.equal(store.list('11').length,1);assert.ok(store.pending('11'));
   handleUpdate(store,message(3,'23,50'),options);assert.equal(store.list('11')[1].amount,2350);
 }finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});
test('transação reverte registro, resposta e cursor em falha',t=>{
 const store=fixture(t);
 assert.throws(()=>store.process({update_id:1},()=>{store.insert('11',{amount:10});store.enqueue('sendMessage',{text:'teste'});throw new Error('simulada');}));
 assert.equal(store.list('11').length,0);assert.equal(store.offset,0);assert.equal(store.nextDelivery(),null);
});
test('falha de rede preserva a resposta para reenviar sem duplicar gasto',async t=>{
 const store=fixture(t);handleUpdate(store,message(1,'pão 10'),options);
 await assert.rejects(flushOutbox(store,async()=>{throw new TelegramError('sendMessage',429,2);}));
 assert.ok(store.nextDelivery());assert.equal(store.list('11').length,1);
 let sent=0;await flushOutbox(store,async()=>{sent++;});assert.equal(sent,1);assert.equal(store.nextDelivery(),null);
 store.enqueue('sendMessage',{chat_id:11,text:'a'});store.enqueue('sendMessage',{chat_id:22,text:'b'});
 await flushOutbox(store,async(_,payload)=>{if(payload.chat_id===11)throw new TelegramError('sendMessage',403);});
 assert.equal(store.nextDelivery(),null);
});
test('cliente usa POST e não revela token em falhas',async()=>{
 const token='123:fake_private_token';
 const api=createTelegram(token,{fetchImpl:async(url,request)=>{
   assert.equal(request.method,'POST');assert.equal(JSON.parse(request.body).timeout,25);
   return {ok:true,json:async()=>({ok:true,result:[]})};
 }});
 assert.deepEqual(await api('getUpdates',{timeout:25}),[]);
 const broken=createTelegram(token,{fetchImpl:async()=>{throw new Error(`request failed https://example/${token}`);}});
 await assert.rejects(broken('getMe'),error=>!error.message.includes(token)&&error.code==='rede');
 const limited=createTelegram(token,{fetchImpl:async()=>({ok:false,status:429,json:async()=>({ok:false,error_code:429,parameters:{retry_after:7}})})});
 await assert.rejects(limited('sendMessage'),error=>error.retryAfter===7);
});
test('configuração valida token e fuso, sem exigir lista de usuários',()=>{
 assert.throws(()=>config({}),/Preencha/);
 assert.doesNotThrow(()=>config({TELEGRAM_BOT_TOKEN:'123:fake'}));
 assert.throws(()=>config({TELEGRAM_BOT_TOKEN:'123:fake',BOT_TIMEZONE:'nope'}),/BOT_TIMEZONE/);
 assert.equal(Object.hasOwn(config({TELEGRAM_BOT_TOKEN:'123:fake'}),'allowedUsers'),false);
 assert.match(config({TELEGRAM_BOT_TOKEN:'123:fake'}).path,/[/\\]data[/\\]zelumi\.sqlite$/);
 assert.match(config({TELEGRAM_BOT_TOKEN:'123:fake',BOT_DB_PATH:'./data/custom.sqlite'}).path,/[/\\]data[/\\]custom\.sqlite$/);
 assert.equal(localDate(now,'America/Sao_Paulo'),'2026-11-01');
});

test('identidade privada precisa ser válida mesmo com cadastro aberto',t=>{
 const store=fixture(t);
 for(const [i,id] of [undefined,0,-1,1.5,'11'].entries()) {
  const update=message(i+1,'pão 10');update.message.from.id=id;
  handleUpdate(store,update,options);
 }
 const other=message(6,'pão 10');other.message.chat.id=22;handleUpdate(store,other,options);
 assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM records').get().n,0);
});
test('qualquer novo usuário pode iniciar e usar o bot sem cadastrar ID',t=>{
 const store=fixture(t);
 handleUpdate(store,message(1,'/start',333),options);
 assert.match(drain(store)[0].payload.text,/pão 10/);
 handleUpdate(store,message(2,'pão 10',333),options);
 assert.equal(store.list('333')[0].amount,1000);
 handleUpdate(store,message(3,'/ultimos',444),options);
 assert.match(drain(store).at(-1).payload.text,/ainda não tem lançamentos/);
});


test('configuração mantém banco padrão e caminhos fornecidos relativos ao diretório de execução',()=>{
 const env={TELEGRAM_BOT_TOKEN:'123:fake'};
 assert.equal(config(env).path,resolve('data/zelumi.sqlite'));
 assert.equal(config({...env,BOT_DB_PATH:'./data/custom.sqlite'}).path,resolve('data/custom.sqlite'));
 const absolute=resolve('data/absolute.sqlite');
 assert.equal(config({...env,BOT_DB_PATH:absolute}).path,absolute);
});
