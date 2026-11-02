import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parse,resolve,money,schedule} from '../shared/parser.mjs';
const now=new Date(2026,10,1,12);
test('números de modelos ficam na descrição e não disputam o valor',()=>{
 for(const [text,description,amount,installments] of [
  ['video game xbox 360 1500','Video game xbox 360',150000,1],
  ['Xbox 360 R$ 1.500,00','Xbox 360',150000,1],
  ['iphone 15 4000','Iphone 15',400000,1],
  ['xbox 360 1500 em 10x','Xbox 360',150000,10],
  ['xbox 360 10x 150','Xbox 360',150000,10],
 ]){
  const r=parse(text,now);
  assert.equal(r.status,'ready',text);assert.equal(r.description,description,text);
  assert.equal(r.amount,amount,text);assert.equal(r.installments,installments,text);
 }
 const pending=parse('xbox 360',now);
 assert.equal(pending.status,'missing_amount');assert.equal(resolve(pending,'1500').description,'Xbox 360');
 assert.equal(parse('pão 2 10',now).status,'ambiguous');
 assert.equal(parse('xbox 360 2 1500',now).status,'ambiguous');
 assert.equal(parse('xbox 360,50',now).amount,36050);
 assert.equal(parse('iphone 15,50',now).amount,1550);
});
test('data brasileira explícita não vira valor nem descrição',()=>{
 for(const text of ['sorvete 7 04/04/2026','04/04/2026 sorvete 7','sorvete no dia 4/4/2026 7']){
  const r=parse(text,now);
  assert.equal(r.status,'ready',text);assert.equal(r.amount,700,text);
  assert.equal(r.date,'2026-04-04',text);assert.equal(r.description,'Sorvete',text);
 }
 const r=resolve(parse('sorvete 04/04/2026',now),'7');
 assert.equal(r.status,'ready');assert.equal(r.date,'2026-04-04');assert.equal(r.amount,700);
 assert.equal(parse('sorvete 7 29/02/2024',now).date,'2024-02-29');
 assert.equal(parse('menu do dia por 7 04/04/2026',now).description,'Menu dia');
 for(const date of ['31/04/2026','29/02/2026','00/04/2026','04/13/2026','04/04/0000','04/04/1899','04/04/9991','04/04/26','04/04/2026 05/04/2026']){
  assert.equal(parse(`sorvete 7 ${date}`,now).status,'invalid',date);
 }
});
test('categorias prontas reconhecem termos, marcas, plurais e acentos',()=>{
 const cases={
  'Alimentação':['pães','SUPERMERCADO','açaí','iFood','restaurantes'],
  'Transporte':['ônibus','combustível','estacionamento','pedágio','táxis'],
  'Casa':['aluguel','condomínio','energia elétrica','conta de água','internet'],
  'Saúde':['farmácia','remédios','dentista','exames','fisioterapia'],
  'Educação':['faculdade','escola','cursos','material escolar','livros'],
  'Lazer':['cinema','show','teatro','jogos','parque'],
  'Compras':['roupas','calçados','notebook','celular','eletrônicos'],
  'Assinaturas':['Netflix','Spotify','assinatura de software','assinaturas'],
  'Cuidados pessoais':['cabeleireiro','barbeiro','manicure','cosméticos'],
  'Pets':['veterinário','pet shop','ração para cachorro','banho e tosa'],
  'Viagens':['passagem aérea','hotel','hospedagem','pousada'],
  'Impostos e taxas':['IPTU','IPVA','imposto de renda','tarifa bancária'],
 };
 for(const [category,descriptions] of Object.entries(cases))for(const description of descriptions){
  const result=parse(`${description} 50`,now);
  assert.equal(result.status,'ready',description);assert.equal(result.category,category,description);
 }
});
test('expressões específicas resolvem termos internos sem esconder outras despesas',()=>{
 for(const [description,category] of [
  ['Uber Eats','Alimentação'],['plano de saúde','Saúde'],['seguro saúde','Saúde'],
  ['seguro viagem','Viagens'],['material escolar','Educação'],['ração para cachorro','Pets'],
  ['assinatura de jogos','Assinaturas'],['livro de receitas','Educação'],
 ])assert.equal(parse(`${description} 50`,now).category,category,description);
 for(const description of ['mercado e farmácia','hotel e restaurante','Uber Eats e táxi','material escolar e cinema','Netflix e Spotify e cinema']){
  assert.equal(parse(`${description} 50`,now).category,'Outros',description);
 }
 assert.equal(parse('mercado e padaria 50',now).category,'Alimentação');
});
test('classificação não usa trechos de palavras nem adivinha marcas ambíguas',()=>{
 for(const description of ['Uberlândia','cafeína','aguarela','escolaridade','Google','Amazon','compra desconhecida']){
  assert.equal(parse(`${description} 50`,now).category,'Outros',description);
 }
 assert.equal(parse('CAFÉ, padaria! 50',now).category,'Alimentação');
 assert.equal(parse('almoço das crianças 50',now).category,'Alimentação');
 assert.equal(parse('recebi Netflix 50',now).category,'Receitas');
 assert.equal(resolve(parse('veterinário',now),'50').category,'Pets');
});
test('limpeza da descrição preserva palavras acentuadas inteiras',()=>{
 assert.equal(parse('raio x 150',now).description,'Raio x');
 assert.equal(parse('juros das parcelas 50',now).description,'Juros das parcelas');
 assert.equal(parse('paguei plano de saúde 50',now).description,'Plano saúde');
 assert.equal(parse('plano de sau\u0301de 50',now).description.normalize('NFC'),'Plano saúde');
 assert.equal(parse('plano de sau\u0301de 50',now).category,'Saúde');
 assert.equal(parse('comprei sabonete líquido 20',now).description,'Sabonete líquido');
});
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

test('valor total seguido de x12 não vira mil parcelas',()=>{
 for(const text of ['google 1000 x12','Google R$ 1.000,00 x12','google x12 1000','google 1000 X12']) {
  const r=parse(text,now);
  assert.equal(r.status,'ready',text);assert.equal(r.amount,100000,text);
  assert.equal(r.installments,12,text);assert.equal(r.description,'Google',text);
  const rows=schedule(r);
  assert.equal(rows.length,12);assert.equal(rows[0].amount,8334);
  assert.equal(rows.reduce((sum,row)=>sum+row.amount,0),100000);
 }
 const each=parse('google 12x 80',now);
 assert.equal(each.amount,96000);assert.equal(each.installments,12);assert.equal(each.description,'Google');
 assert.equal(parse('google 1000 em 12x',now).amount,100000);
});
test('marcador de parcelas sem valor pede total e mantém quantidade',()=>{
 const r=parse('google x12',now);
 assert.equal(r.status,'missing_amount');assert.equal(r.installments,12);
 const ready=resolve(r,'1000');assert.equal(ready.amount,100000);assert.equal(ready.installments,12);
 assert.equal(parse('google 1000 x0',now).status,'invalid');
 assert.equal(parse('google 1000 x121',now).status,'invalid');
 assert.equal(parse('google 1000 x12 80',now).status,'ambiguous');
 assert.equal(parse('google 12x 80 1000',now).status,'ambiguous');
});
