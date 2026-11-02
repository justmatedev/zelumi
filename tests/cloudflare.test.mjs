import {migrate} from './helpers/d1.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../bot/store.mjs';
import {exportLocal} from '../scripts/export-local.mjs';
import {resolve} from 'node:path';
import {createWorker} from '../cloudflare/worker.mjs';
import {D1Store} from '../cloudflare/store.mjs';
import {deliver} from '../cloudflare/outbox.mjs';
import {handleUpdate} from '../bot/engine.mjs';
import {TelegramError} from '../bot/telegram.mjs';

process.env.WRANGLER_LOG_PATH=resolve('.wrangler/logs');
process.env.WRANGLER_SEND_METRICS='false';
const {getPlatformProxy}=await import('wrangler');
const now=new Date('2026-11-02T04:30:00Z');
const secret='local_test_secret_with_at_least_32_characters';
const opts={now,timezone:'America/Sao_Paulo'};
const message=(id,text,user=11,date=1793595600)=>({update_id:id,message:{message_id:id,date,from:{id:user},chat:{id:user,type:'private'},text}});
const callback=(id,data,user=11)=>({update_id:id,callback_query:{id:`query${id}`,data,from:{id:user},message:{date:1793595600,chat:{id:user,type:'private'}}}});
const request=(update,s=secret)=>new Request('https://test.workers.dev/telegram/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':s},body:JSON.stringify(update)});

test('Cloudflare Worker com D1 local real',async t=>{
 const platform=await getPlatformProxy({configPath:'tests/wrangler.jsonc',persist:false,remoteBindings:false,envFiles:[resolve('.dev.vars.example')]});
 t.after(()=>platform.dispose());
 const db=platform.env.DB;
 await migrate(db);
 const env={DB:db,TELEGRAM_BOT_TOKEN:'123:fake',TELEGRAM_WEBHOOK_SECRET:secret,BOT_TIMEZONE:'America/Sao_Paulo'};
 let sent=[];
 const worker=createWorker({clock:()=>now,apiFactory:()=>async(method,payload)=>{sent.push({method,payload});return true;}});
 const count=async()=>Number((await db.prepare('SELECT COUNT(*) AS n FROM cloud_records').first()).n);
 const reset=async()=>{for(const table of ['cloud_processed','cloud_outbox','cloud_state','cloud_records','cloud_meta'])await db.prepare(`DELETE FROM ${table}`).run();sent=[];};
 const one=()=>db.prepare('SELECT id,body FROM cloud_records ORDER BY sequence DESC LIMIT 1').first();
 await t.test('autentica antes de gravar e rejeita corpos inválidos',async()=>{
   assert.equal((await worker.fetch(request(message(1,'pão 10'),'wrong'),env)).status,401);
   assert.equal((await worker.fetch(request({update_id:'bad'}),env)).status,400);
   assert.equal((await worker.fetch(new Request('https://test/telegram/webhook'),env)).status,405);
   assert.equal((await worker.fetch(request(message(1,'pão 10')),{...env,TELEGRAM_WEBHOOK_SECRET:''})).status,503);
   assert.equal(await count(),0);
 });
 await t.test('salva com data original, inclusive ontem e resumos do dia atual',async()=>{
   await reset();
   const sentDate=Math.floor(new Date('2026-11-02T02:55:00Z').getTime()/1000); // 01/11 23:55
   assert.equal((await worker.fetch(request(message(1,'pão 10',11,sentDate)),env)).status,200);
   assert.equal(JSON.parse((await one()).body).date,'2026-11-01');
   await worker.fetch(request(message(2,'ontem almoço 35',11,sentDate)),env);
   assert.equal(JSON.parse((await one()).body).date,'2026-10-31');
   await worker.fetch(request(message(3,'/hoje')),env);
   assert.match(sent.at(-1).payload.text,/Saídas: R\$\s*0,00/);
 });
 await t.test('deduplica webhook concorrente e entrega cada resposta uma vez',async()=>{
   await reset();const update=message(1,'pão 10');
   const results=await Promise.all([worker.fetch(request(update),env),worker.fetch(request(update),env)]);
   assert.ok(results.every(r=>r.status===200));assert.equal(await count(),1);
   assert.equal(sent.filter(s=>s.method==='sendMessage').length,1);
 });
 await t.test('conflito entre updates diferentes preserva registros após reenvio',async()=>{
   await reset();const a=message(1,'pão 10'),b=message(2,'uber 20');
   const updates=[a,b];const responses=await Promise.all(updates.map(u=>worker.fetch(request(u),env)));
   for(let i=0;i<responses.length;i++)if(responses[i].status!==200)assert.equal((await worker.fetch(request(updates[i]),env)).status,200);
   assert.equal(await count(),2);
 });
 await t.test('pergunta persiste entre instâncias; editar e desfazer usam UUID',async()=>{
   await reset();await worker.fetch(request(message(1,'pão')),env);
   const another=createWorker({clock:()=>now,apiFactory:()=>async()=>true});
   await another.fetch(request(message(2,'10')),env);assert.equal(await count(),1);
   const id=(await one()).id;assert.match(id,/^[a-f0-9-]{36}$/);
   await worker.fetch(request(callback(3,`edit:${id}`)),env);
   await worker.fetch(request(message(4,'pão 15')),env);
   assert.equal(await count(),1);assert.equal(JSON.parse((await one()).body).amount,1500);
   await worker.fetch(request(callback(5,`undo:${id}`,22)),env);assert.equal(await count(),1);
   await worker.fetch(request(callback(6,`undo:${id}`)),env);assert.equal(await count(),0);
 });
 await t.test('cadastro livre aceita usuário novo sem expor lançamentos de outros',async()=>{
   await reset();await worker.fetch(request(message(1,'pão 10',33)),env);assert.equal(await count(),1);
   assert.equal((await db.prepare('SELECT owner FROM cloud_records').first()).owner,'33');
   await worker.fetch(request(message(2,'/id',33)),env);assert.match(sent.at(-1).payload.text,/33/);assert.doesNotMatch(sent.at(-1).payload.text,/liberar|ALLOWED_USER/);
   await worker.fetch(request(message(3,'pão 10')),env);assert.equal(await count(),2);
   await worker.fetch(request(message(4,'/mes',22)),env);assert.match(sent.at(-1).payload.text,/Saídas: R\$\s*0,00/);
 });
 await t.test('resposta fica no D1 após falha Telegram e cron a reenvia',async()=>{
   await reset();const offline=createWorker({clock:()=>now,apiFactory:()=>async()=>{throw new TelegramError('sendMessage',429,120);}});
   assert.equal((await offline.fetch(request(message(1,'pão 10')),env)).status,200);assert.equal(await count(),1);
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM cloud_outbox').first()).n,1);
   await worker.scheduled({},env);assert.equal(sent.length,0);
   const later=createWorker({clock:()=>new Date(now.getTime()+180000),apiFactory:()=>async(method,payload)=>sent.push({method,payload})});
   await later.scheduled({},env);assert.equal(sent.length,1);
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM cloud_outbox').first()).n,0);
 });
 await t.test('falha em lote reverte update e lançamento juntos',async()=>{
   await reset();const store=new D1Store(db,{botId:'123',now});
   await assert.rejects(store.process(message(1,'pão 10'),()=>{store.insert('11',{amount:1000,date:'2026-11-02',type:'despesa'});store.op('SQL INVÁLIDO $GATE');}));
   assert.equal(await count(),0);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM cloud_processed').first()).n,0);
 });
 await t.test('não mistura bancos de bots diferentes',async()=>{
   await reset();await worker.fetch(request(message(1,'pão 10')),env);
   assert.equal((await worker.fetch(request(message(2,'uber 20')),{...env,TELEGRAM_BOT_TOKEN:'999:fake'})).status,503);
   assert.equal(await count(),1);
 });
 await t.test('importa SQLite sem duplicar dados e preserva perguntas e callbacks antigos',async()=>{
   await reset();const dir=mkdtempSync(join(tmpdir(),'miudo-export-')),path=join(dir,'local.sqlite'),output=join(dir,'import.sql');
   let local;
   try{
     local=new Store(path);local.setMeta('bot_id','123');
     handleUpdate(local,message(100,"café d'água 10"),opts);
     handleUpdate(local,message(101,'uber'),opts);
     let row;while((row=local.nextDelivery()))local.delivered(row.id);
     local.close();local=null;
     assert.equal(exportLocal(path,output,now.getTime()),1);
     const lines=readFileSync(output,'utf8').trim().split('\n');
     await db.batch(lines.map(sql=>db.prepare(sql)));
     await db.batch(lines.map(sql=>db.prepare(sql))); // Reimportar não duplica.
     assert.equal(await count(),1);
     await worker.fetch(request(message(100,"café d'água 10")),env);
     assert.equal(await count(),1);
     await worker.fetch(request(message(102,'20')),env);assert.equal(await count(),2);
     await worker.fetch(request(callback(103,'undo:1')),env);assert.equal(await count(),1);
   }finally{local?.close();rmSync(dir,{recursive:true,force:true});}
 });
 await t.test('/ultimos com 10 registros permanece dentro de 50 queries D1',async()=>{
   await reset();for(let i=1;i<=12;i++)await worker.fetch(request(message(i,`pão ${i}`)),env);
   let queries=0;
   const tracked={prepare(sql){queries++;return db.prepare(sql);},batch(statements){return db.batch(statements);}};
   await worker.fetch(request(message(20,'/ultimos')),{...env,DB:tracked});
   assert.ok(queries<=50,`${queries} queries`);
   assert.equal(sent.slice(-10).filter(s=>s.method==='sendMessage').length,10);
 });
});
