import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schedule} from '../dist/parser.mjs';
import {validateEdit,readStored,normalizeSearch} from '../finance/model.mjs';
import {buildProjection,recordVersion} from '../finance/version.mjs';
const input={description:'Google',type:'despesa',category:'Outros',amount:100000,date:'2026-01-31',installments:12,installmentStartMonth:null};
test('centavos, mês inicial, bissexto e passagem de ano',()=>{
 const r={...input,installmentStartMonth:'2026-12'},rows=schedule(r);
 assert.equal(rows[0].date,'2026-12-31');assert.equal(rows[1].date,'2027-01-31');assert.equal(rows[2].date,'2027-02-28');assert.equal(r.date,'2026-01-31');
 assert.deepEqual(rows.map(s=>s.amount),[8334,8334,8334,8334,8333,8333,8333,8333,8333,8333,8333,8333]);
 assert.equal(schedule({...input,date:'2024-01-31'})[1].date,'2024-02-29');assert.equal(schedule({...r,installments:1})[0].date,input.date);
});
test('validação estrita, receitas e busca Unicode literal',()=>{
 assert.equal(validateEdit(input).description,'Google');assert.equal(normalizeSearch('PÃO'),'pao');assert.equal(normalizeSearch('pão %_'),'pao %_');
 for(const extra of [{amount:0},{amount:100000000001},{date:'2026-02-30'},{date:'1899-01-01'},{installments:121},{category:'Receitas'},{owner:'outro'},{description:'a'.repeat(201)}])assert.throws(()=>validateEdit({...input,...extra}));
 assert.equal(validateEdit({...input,type:'receita',category:'Receitas'}).type,'receita');
});
test('legado válido preservado, ausente recuperado sem reescrever corpo',()=>{
 const old={...input,schedule:schedule(input),original:'google 1000 x12'};delete old.installmentStartMonth;
 const body=JSON.stringify(old),r=readStored(body);assert.deepEqual(r.schedule,old.schedule);assert.equal(JSON.stringify(old),body);
 assert.deepEqual(readStored(JSON.stringify(input)).schedule,schedule(input));
 assert.throws(()=>readStored(JSON.stringify({...input,amount:-1})));
 assert.throws(()=>readStored(JSON.stringify({...old,schedule:[{date:'2026-01-31',amount:1}]})));
 const p=buildProjection(body);assert.equal(p.searchName,'google');assert.equal(p.firstMonth,'2026-01');assert.match(recordVersion(body),/^[a-f0-9]{64}$/);
});
test('ano final do cronograma pode chegar a 9999',()=>{assert.equal(readStored(JSON.stringify({...input,date:'9990-01-31',installments:120})).schedule.at(-1).date,'9999-12-31');});
