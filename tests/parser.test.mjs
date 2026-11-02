import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parse,resolve,money,schedule} from '../dist/parser.mjs';
const now=new Date(2026,10,1,12);
test('mensagens curtas e moeda brasileira',()=>{
 assert.equal(parse('pao 10',now).amount,1000);
 assert.equal(parse('uber 23,50',now).category,'Transporte');
 assert.equal(parse('mercado R$ 1.234,56',now).amount,123456);
 assert.equal(money('1.800'),180000);
 assert.equal(parse('ontem almoço 35',now).date,'2026-10-31');
 assert.equal(parse('recebi 200 da venda da cadeira',now).type,'receita');
});
test('informações faltantes e ambiguidades',()=>{
 assert.equal(parse('pão',now).status,'missing_amount');
 assert.equal(parse('pão 2 10',now).status,'ambiguous');
 assert.equal(resolve(parse('pão',now),'10,50').amount,1050);
 assert.equal(parse('10',now).status,'missing_description');
 assert.equal(parse('almoço uns 35',now).status,'ambiguous');
 assert.equal(parse('pão amanhã 10',now).status,'invalid');
 assert.equal(parse('paguei a fatura 500',now).status,'invalid');
 assert.equal(parse('pão 0',now).status,'invalid');
 assert.equal(parse('pão -10',now).status,'invalid');
});
test('parcelas e arredondamento sem perder centavos',()=>{
 const a=parse('notebook 3000 em 10x',now), b=parse('notebook 10x 300',now);
 assert.equal(a.amount,300000); assert.equal(a.installments,10); assert.equal(b.amount,a.amount);
 const installments=schedule({...a,date:'2026-01-31',amount:10000,installments:3});
 assert.equal(installments.reduce((sum,x)=>sum+x.amount,0),10000);
 assert.equal(installments[1].date,'2026-02-28');
 assert.equal(schedule({...a,date:'2026-12-31'})[1].date,'2027-01-31');
});
