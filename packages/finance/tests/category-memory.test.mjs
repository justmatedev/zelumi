import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '@zelumi/finance/parser';
import {classifyExpenseDetailed} from '@zelumi/finance/categories';
import {normalizeCategoryDescription,chooseLocalCategory} from '../src/category-memory.mjs';

test('descrições repetidas ignoram ruído mas preservam modelos e compatibilidade com o bot',()=>{
 assert.equal(normalizeCategoryDescription('  SORVETE, da Bâmbi! '),'sorvete bambi');
 assert.equal(normalizeCategoryDescription('iPhone 15'),'iphone 15');
 assert.notEqual(normalizeCategoryDescription('iPhone 15'),normalizeCategoryDescription('iPhone 16'));
 const parsed=parse('paguei pente de máquina cortar cabelo 37,78');
 assert.equal(normalizeCategoryDescription('pente de máquina cortar cabelo'),normalizeCategoryDescription(parsed.description));
});
test('vocabulário cotidiano classifica sem usar marca ambígua ou esconder conflitos',()=>{
 for(const [description,category] of [['Sorvete bambi','Alimentação'],['Cabide','Compras'],['Pente para maquina cortar cabelo','Cuidados pessoais']])assert.equal(classifyExpenseDetailed(description).category,category);
 assert.equal(classifyExpenseDetailed('Cursor credito para vaga').reason,'none');
 assert.equal(classifyExpenseDetailed('sorvete e farmácia').reason,'conflict');
 assert.equal(classifyExpenseDetailed('fatura cartao picpay').reason,'excluded');
 assert.equal(classifyExpenseDetailed('sorvete no cartao picpay').category,'Alimentação');
});
test('escolha pessoal, inclusive Outros, prevalece e receitas nunca consultam IA',()=>{
 assert.deepEqual(chooseLocalCategory({type:'despesa',description:'sorvete',manual:'Outros'}),{category:'Outros',source:'memory',needsAI:false});
 assert.equal(chooseLocalCategory({type:'receita',description:'sorvete',manual:'Compras'}).category,'Receitas');
 assert.equal(chooseLocalCategory({type:'despesa',description:'desconhecido'}).needsAI,true);
 for(const description of ['mercado e farmacia','fatura cartao mari','transferencia para conta'])assert.equal(chooseLocalCategory({type:'despesa',description}).needsAI,false);
});
test('termos pessoais respeitam palavras completas e deixam outras despesas conflitarem',()=>{
 const terms=[{phrase:'bambi',category:'Alimentação'},{phrase:'bambi presentes',category:'Compras'}];
 assert.equal(chooseLocalCategory({type:'despesa',description:'bambi presentes',terms}).category,'Compras');
 assert.equal(chooseLocalCategory({type:'despesa',description:'bambino',terms}).needsAI,true);
 assert.equal(chooseLocalCategory({type:'despesa',description:'bambi e farmacia',terms}).category,'Outros');
});
test('sugestões precisam de três descrições manuais distintas e nenhuma evidência conflitante',async()=>{
 const {suggestTerms}=await import('../src/category-memory.mjs');
 const associations=[{description_key:'bambi baunilha',category:'Alimentação'},{description_key:'bambi morango',category:'Alimentação'},{description_key:'bambi chocolate',category:'Alimentação'}];
 assert.ok(suggestTerms(associations).some(r=>r.phrase==='bambi'&&r.category==='Alimentação'&&r.examples===3));
 assert.deepEqual(suggestTerms([associations[0],associations[0],associations[0]]),[]);
 assert.equal(suggestTerms([...associations,{description_key:'bambi presentes',category:'Compras'}]).some(r=>r.phrase==='bambi'),false);
 assert.deepEqual(suggestTerms(associations.map(r=>({...r,source:'ai'}))),[]);
});
