import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {Store} from '../bot/store.mjs';
import {prepareOwner} from '../cloudflare/finance/projection.mjs';
import {monthlySQL} from '../finance/sql.mjs';
import {migrate} from './helpers/d1.mjs';
process.env.WRANGLER_LOG_PATH=resolve('.wrangler/logs');process.env.WRANGLER_SEND_METRICS='false';
const {getPlatformProxy}=await import('wrangler');
const record={description:'Pão',type:'despesa',category:'Alimentação',date:'2026-01-31',amount:100000,installments:12};
test('SQLite mensal preserva centavos e separa dia de mês',()=>{
 const store=new Store(':memory:');try{store.insert('11',record);assert.equal(store.summary('11','2026-01').expense,8334);assert.equal(store.summary('11','2026-02').expense,8334);assert.equal(store.summary('11','2026-01-31').expense,100000);assert.equal(store.summary('22','2026-01').expense,0);}finally{store.close();}
});
test('D1 prepara legado sem resultados parciais e invalida cache concorrente',async t=>{
 const p=await getPlatformProxy({configPath:'tests/wrangler.jsonc',persist:false,remoteBindings:false,envFiles:[resolve('.dev.vars.example')]});t.after(()=>p.dispose());const db=p.env.DB;await migrate(db);
 const body=JSON.stringify(record);await db.batch(Array.from({length:45},(_,i)=>db.prepare('INSERT INTO cloud_records(id,owner,body) VALUES(?,?,?)').bind(String(i+1),'11',body)));
 assert.equal((await prepareOwner(db,'11')).status,'preparing');assert.equal((await prepareOwner(db,'11')).status,'preparing');assert.equal((await prepareOwner(db,'11')).status,'ready');
 assert.equal((await db.prepare(monthlySQL('cloud_records')).bind('11','2026-02','2026-02','2026-02').first()).expense,45*8334);
 await db.prepare("UPDATE cloud_records SET body=? WHERE id='1'").bind(JSON.stringify({...record,description:'Uber',amount:12000})).run();
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM finance_projection WHERE record_id='1'").first()).n,0);
 let changed=false;const raced={prepare:q=>db.prepare(q),async batch(statements){if(!changed){changed=true;await db.prepare("UPDATE cloud_records SET body=? WHERE id='1'").bind(JSON.stringify({...record,description:'Médico'})).run();}return db.batch(statements);}};
 assert.equal((await prepareOwner(raced,'11')).status,'preparing');assert.equal((await prepareOwner(db,'11')).status,'ready');assert.equal((await db.prepare("SELECT search_name FROM finance_projection WHERE record_id='1'").first()).search_name,'medico');
 const invalid=JSON.stringify({...record,amount:-1});await db.prepare("INSERT INTO cloud_records(id,owner,body) VALUES('bad','22',?)").bind(invalid).run();assert.equal((await prepareOwner(db,'22')).status,'invalid');assert.equal((await db.prepare("SELECT body FROM cloud_records WHERE id='bad'").first()).body,invalid);
});
