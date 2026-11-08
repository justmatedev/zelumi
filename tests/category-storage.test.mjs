import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
import {migrate} from './helpers/d1.mjs';
import {FinanceStore} from '../apps/api/src/finance/store.mjs';
import {CategoryStore} from '../apps/api/src/categories/store.mjs';
import {recordVersion} from '@zelumi/finance/server/version';
const now=1793617200000;
const record={description:'Bambi da esquina',type:'despesa',category:'Outros',amount:300,date:'2026-11-01',installments:1,installmentStartMonth:null};
async function setup(t){const db=sqliteD1();t.after(()=>db.raw.close());await migrate(db);const body=JSON.stringify(record);await db.prepare("INSERT INTO cloud_records(id,owner,body) VALUES('1','11',?)").bind(body).run();return {db,store:new FinanceStore(db),categories:new CategoryStore(db),version:recordVersion(body)};}
test('correção e memória confirmam juntas, replay não ensina de novo e contas são isoladas',async t=>{
 const {db,store,categories,version}=await setup(t),operationKey=randomUUID();
 const args={owner:'11',id:'1',kind:'PUT',expectedVersion:version,record:{...record,category:'Alimentação'},categoryMemoryAction:'remember',operationKey,nowMs:now};
 const response=await store.mutate(args);assert.deepEqual(await store.mutate(args),response);
 assert.equal((await categories.lookup('11','bambi esquina',now)).manual,'Alimentação');
 assert.equal((await categories.lookup('22','bambi esquina',now)).manual,null);
 assert.equal((await store.detail('11','1')).categoryMemory.category,'Alimentação');
 await assert.rejects(store.mutate({...args,categoryMemoryAction:'forget'}),e=>e.code==='OPERATION_KEY_REUSED');
 await assert.rejects(store.mutate({...args,operationKey:randomUUID(),record:{...record,category:'Pets'}}),e=>e.code==='RECORD_CHANGED');
 assert.equal((await categories.lookup('11','bambi esquina',now)).manual,'Alimentação');
 assert.equal((await db.prepare("SELECT version FROM cloud_state WHERE owner='11'").first()).version,1);
});
test('falha financeira reverte memória e recibo; edição comum não cria associação',async t=>{
 const {db,store,categories,version}=await setup(t);
 await db.prepare("CREATE TRIGGER fail_save BEFORE UPDATE ON cloud_records BEGIN SELECT RAISE(ABORT,'simulada'); END").run();
 const args={owner:'11',id:'1',kind:'PUT',expectedVersion:version,record:{...record,category:'Pets'},categoryMemoryAction:'remember',operationKey:randomUUID(),nowMs:now};
 await assert.rejects(store.mutate(args));assert.equal((await categories.lookup('11','bambi esquina',now)).manual,null);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM finance_operations').first()).n,0);
 await db.prepare('DROP TRIGGER fail_save').run();await store.mutate({...args,categoryMemoryAction:'keep'});
 assert.equal((await categories.lookup('11','bambi esquina',now)).manual,null);
});
test('Outros explícito é lembrado, cache IA não substitui humano e esquecer remove só associação',async t=>{
 const {store,categories,version}=await setup(t);
 await store.mutate({owner:'11',id:'1',kind:'PUT',expectedVersion:version,record,categoryMemoryAction:'remember',operationKey:randomUUID(),nowMs:now});
 await categories.cacheAI('11','bambi esquina','Pets','test-v1',now);
 const lookup=await categories.lookup('11','bambi esquina',now,'test-v1');assert.equal(lookup.manual,'Outros');
 const latest=await store.detail('11','1');
 await store.mutate({owner:'11',id:'1',kind:'PUT',expectedVersion:latest.version,record,categoryMemoryAction:'forget',operationKey:randomUUID(),nowMs:now});
 assert.equal((await categories.lookup('11','bambi esquina',now)).manual,null);
 assert.equal((await store.detail('11','1')).category,'Outros');
});
test('gestão de termos e associações usa revisão, recibo, escopo e versão do bot',async t=>{
 const {db,categories}=await setup(t);const key=crypto.randomUUID();
 const args={owner:'11',resource:'terms',method:'PUT',key:'bambi',category:'Alimentação',expectedRevision:null,operationKey:key,nowMs:now};
 const response=await categories.manage(args);assert.deepEqual(await categories.manage(args),response);
 assert.deepEqual(await categories.terms('22'),[]);assert.equal((await categories.terms('11'))[0].category,'Alimentação');
 await assert.rejects(categories.manage({...args,operationKey:randomUUID(),category:'Compras'}),e=>e.code==='RULE_CHANGED');
 assert.equal((await db.prepare("SELECT version FROM cloud_state WHERE owner='11'").first()).version,1);
 const listing=await categories.list('11','terms',0);assert.equal(listing.items[0].key,'bambi');assert.equal(listing.items[0].revision,1);
 await categories.manage({...args,method:'DELETE',expectedRevision:1,operationKey:randomUUID()});assert.deepEqual(await categories.terms('11'),[]);
});
test('limpeza remove cache expirado e orçamento antigo sem apagar correções humanas',async t=>{
 const {db,categories,store,version}=await setup(t);
 await store.mutate({owner:'11',id:'1',kind:'PUT',expectedVersion:version,record,categoryMemoryAction:'remember',operationKey:randomUUID(),nowMs:now});
 await categories.cacheAI('11','antigo','Compras','v1',now-31*86400000);
 await categories.reserveAttempt('11','2026-01-01',{global:2,user:2});
 const {cleanupCategories}=await import('../apps/api/src/categories/store.mjs');await cleanupCategories(db,now);
 assert.equal((await categories.lookup('11','bambi esquina',now)).manual,'Outros');assert.equal((await db.prepare("SELECT COUNT(*) n FROM category_memory WHERE source='ai'").first()).n,0);assert.equal((await db.prepare('SELECT COUNT(*) n FROM category_ai_budget').first()).n,0);
});
test('apagar e recriar associação nunca reutiliza revisão de uma aba antiga',async t=>{
 const {categories}=await setup(t);
 for(const resource of ['memory','terms']){
  const base={owner:'11',resource,method:'PUT',key:'bambi',category:'Alimentação',expectedRevision:null,operationKey:randomUUID(),nowMs:now};
  const original=await categories.manage(base);
  await categories.manage({...base,method:'DELETE',expectedRevision:original.revision,operationKey:randomUUID()});
  const replacement=await categories.manage({...base,category:'Compras',operationKey:randomUUID()});
  for(const method of ['PUT','DELETE'])await assert.rejects(categories.manage({...base,method,expectedRevision:original.revision,operationKey:randomUUID()}),e=>e.code==='RULE_CHANGED');
  assert.notEqual(original.revision,replacement.revision);
 }
});
test('limite de termos é verificado no commit mesmo quando outro pedido grava antes da leitura de estado',async t=>{
 const {db,categories:winner}=await setup(t);
 await db.batch(Array.from({length:199},(_,i)=>db.prepare('INSERT INTO category_terms(owner,phrase_key,category,created_at) VALUES(?,?,?,?)').bind('11',`termo ${i}`,'Compras',now)));
 const late=new CategoryStore(db),stmt=late.stmt.bind(late);let injected=false;
 const args={owner:'11',resource:'terms',method:'PUT',key:'ultimo',category:'Compras',expectedRevision:null,operationKey:randomUUID(),nowMs:now};
 late.stmt=(sql,...values)=>{const s=stmt(sql,...values);if(sql==='SELECT COUNT(*) n FROM category_terms WHERE owner=?')return {...s,first:async()=>{const row=await s.first();if(!injected){injected=true;await winner.manage({...args,key:'concorrente',operationKey:randomUUID()});}return row;}};return s;};
 await assert.rejects(late.manage(args),e=>['RULE_CHANGED','RULE_LIMIT'].includes(e.code));
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM category_terms WHERE owner='11'").first()).n,200);
});
test('sugestão verifica conflito também nas associações além das mil recentes',async t=>{
 const {db,categories}=await setup(t);
 const rows=[['bambi presentes','Compras',0],...Array.from({length:1000},(_,i)=>[`outra descricao ${i}`,'Compras',1]),['bambi chocolate','Alimentação',now],['bambi morango','Alimentação',now],['bambi baunilha','Alimentação',now]];
 await db.batch(rows.map(([key,category,at])=>db.prepare("INSERT INTO category_memory(owner,description_key,source,category,updated_at) VALUES(?,?,'manual',?,?)").bind('11',key,category,at)));
 const list=await categories.list('11','terms');assert.equal(list.suggestions.some(s=>s.phrase==='bambi'),false);
});
