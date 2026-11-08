import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
import {migrate} from './helpers/d1.mjs';
import {D1Store} from '../apps/api/src/telegram/store.mjs';
import {FinanceStore} from '../apps/api/src/finance/store.mjs';
import {handleUpdate} from '@zelumi/bot-core/engine';
const now=new Date('2026-11-08T12:00:00Z');
const message=(id,text)=>({update_id:id,message:{from:{id:11},chat:{id:11,type:'private'},text}});
async function setup(t){const db=sqliteD1();t.after(()=>db.raw.close());await migrate(db);return db;}
test('memória corrigida no painel vale no próximo lançamento e confirmação salva a categoria final',async t=>{
 const db=await setup(t),make=()=>new D1Store(db,{botId:'123',now});
 await handleUpdate(make(),message(1,'Bambi 3'),{now});
 const row=await db.prepare("SELECT id FROM cloud_records WHERE owner='11'").first(),finance=new FinanceStore(db),old=await finance.detail('11',row.id);
 const {id,version,schedule,categoryMemory,categorySource,...record}=old;
 await finance.mutate({owner:'11',id,kind:'PUT',expectedVersion:version,record:{...record,category:'Alimentação'},categoryMemoryAction:'remember',operationKey:crypto.randomUUID(),nowMs:now.getTime()});
 await handleUpdate(make(),message(2,'Bambi 7'),{now});
 const latest=await db.prepare('SELECT body FROM cloud_records ORDER BY sequence DESC LIMIT 1').first();assert.equal(JSON.parse(latest.body).category,'Alimentação');
 const out=await db.prepare('SELECT payload FROM cloud_outbox ORDER BY id DESC LIMIT 1').first();assert.match(JSON.parse(out.payload).text,/Alimentação/);
 assert.equal(await handleUpdate(make(),message(2,'Bambi 7'),{now}),false);
});
test('classificação assíncrona termina antes da serialização e resposta',async t=>{
 const db=await setup(t),store=new D1Store(db,{botId:'123',now,classify:async()=>({category:'Compras',source:'ai'})});
 await handleUpdate(store,message(1,'loja desconhecida 50'),{now});
 assert.equal(JSON.parse((await db.prepare('SELECT body FROM cloud_records').first()).body).category,'Compras');
 assert.match(JSON.parse((await db.prepare('SELECT payload FROM cloud_outbox').first()).payload).text,/Compras/);
});
test('correção durante classificação impede commit obsoleto e falha de IA mantém registro local',async t=>{
 const db=await setup(t);let entered,release;const waiting=new Promise(r=>{entered=r;}),pause=new Promise(r=>{release=r;});
 const store=new D1Store(db,{botId:'123',now,classify:async()=>{entered();await pause;return {category:'Compras',source:'ai'};}});
 const work=handleUpdate(store,message(1,'desconhecido 5'),{now});await Promise.race([waiting,new Promise((_,reject)=>setTimeout(()=>reject(new Error("classifier not called")),200))]);
 await db.prepare("UPDATE cloud_state SET version=version+1 WHERE owner='11'").run();release();await assert.rejects(work,/Conflito/);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM cloud_records').first()).n,0);
 const fallback=new D1Store(db,{botId:'123',now,classify:async()=>{throw new Error('offline');}});
 await handleUpdate(fallback,message(1,'sorvete 5'),{now});assert.equal(JSON.parse((await db.prepare('SELECT body FROM cloud_records').first()).body).category,'Alimentação');
});
