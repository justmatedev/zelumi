import {DatabaseSync} from 'node:sqlite';
// Adaptador de teste: executa o SQL real e rollback de batches sem abrir portas.
export function sqliteD1(){
 const raw=new DatabaseSync(':memory:');
 const statement=(sql,args=[])=>({bind:(...values)=>statement(sql,values),async first(){return raw.prepare(sql).get(...args)??null;},async all(){return {results:raw.prepare(sql).all(...args)};},async run(){const result=raw.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)},results:[]};},sql,args});
 return {raw,prepare:sql=>statement(sql),withSession(){return this;},async batch(statements){raw.exec('BEGIN');try{const results=[];for(const s of statements){const p=raw.prepare(s.sql);if(p.columns().length)results.push({results:p.all(...s.args),meta:{changes:0}});else {const r=p.run(...s.args);results.push({results:[],meta:{changes:Number(r.changes)}});}}raw.exec('COMMIT');return results;}catch(e){raw.exec('ROLLBACK');throw e;}}};
}
