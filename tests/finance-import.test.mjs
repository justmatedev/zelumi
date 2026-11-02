import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {Store} from '../bot/store.mjs';
import {exportLocal} from '../scripts/export-local.mjs';
import {FinanceStore} from '../cloudflare/finance/store.mjs';
import {migrate} from './helpers/d1.mjs';
process.env.WRANGLER_LOG_PATH=resolve('.wrangler/logs');process.env.WRANGLER_SEND_METRICS='false';const {getPlatformProxy}=await import('wrangler');
test('importação invalida snapshot somente quando insere e preserva pending',async t=>{
 const platform=await getPlatformProxy({configPath:'tests/wrangler.jsonc',persist:false,remoteBindings:false,envFiles:[resolve('.dev.vars.example')]});t.after(()=>platform.dispose());const db=platform.env.DB;await migrate(db);
 const dir=mkdtempSync(join(tmpdir(),'zelumi-import-')),file=join(dir,'source.sqlite'),sql=join(dir,'import.sql');t.after(()=>rmSync(dir,{recursive:true,force:true}));
 let local=new Store(file);local.setMeta('bot_id','123');const r={description:'Compra',type:'despesa',category:'Outros',date:'2026-01-01',amount:1000,installments:1};for(let i=0;i<21;i++)local.insert('11',r);local.setPending('11',{mode:'amount',expires:Date.now()+600000});local.close();
 const importData=async()=>{exportLocal(file,sql);await db.batch(readFileSync(sql,'utf8').trim().split('\n').map(s=>db.prepare(s)));};
 await importData();const store=new FinanceStore(db);while((await store.ready('11').then(()=>true).catch(e=>e.code==='HISTORY_PREPARING'?false:Promise.reject(e)))===false){}
 const first=await store.entries('11',{page:1,pageSize:20,parts:'all'});assert.equal(first.total,21);assert.ok((await db.prepare("SELECT pending FROM cloud_state WHERE owner='11'").first()).pending);
 await db.prepare("UPDATE cloud_state SET pending=? WHERE owner='11'").bind('{"mode":"current"}').run();
 local=new Store(file);local.insert('11',r);local.close();await importData();
 await assert.rejects(store.entries('11',{page:2,pageSize:20,parts:'all',snapshot:first.snapshot}),e=>e.code==='HISTORY_CHANGED');
 const before=(await db.prepare("SELECT version FROM cloud_state WHERE owner='11'").first()).version;await importData();assert.equal((await db.prepare("SELECT version FROM cloud_state WHERE owner='11'").first()).version,before);assert.equal((await db.prepare("SELECT pending FROM cloud_state WHERE owner='11'").first()).pending,'{"mode":"current"}');
});
