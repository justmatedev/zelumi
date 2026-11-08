import {classifyExpenseDetailed,expenseCategories,normalizeCategoryText} from './categories.mjs';

// Mesmas palavras funcionais removidas pelo parser; números de modelos permanecem.
export const normalizeCategoryDescription=description=>normalizeCategoryText(description)
 .split(' ').filter(word=>!['hoje','ontem','gastei','paguei','comprei','recebi','ganhei','reais','real','por','em','no','na','com','de','da','do','venda','uns'].includes(word)).join(' ');

export function chooseLocalCategory({type,description,manual,terms=[]}){
 if(type==='receita')return {category:'Receitas',source:'rule',needsAI:false};
 if(expenseCategories.includes(manual))return {category:manual,source:'memory',needsAI:false};
 const result=classifyExpenseDetailed(description,{personalTerms:terms});
 return {category:result.category,source:result.reason==='matched'?'rule':'fallback',needsAI:result.reason==='none'};
}

export function suggestTerms(associations){
 const documents=new Map();
 for(const row of associations){if(row.source&&row.source!=='manual')continue;const key=normalizeCategoryDescription(row.description_key);if(key)documents.set(key,row.category);}
 const candidates=new Map();
 for(const [description,category] of documents){
  const words=description.split(' '),seen=new Set();
  for(let start=0;start<words.length;start++)for(let size=1;size<=Math.min(4,words.length-start);size++){
   const parts=words.slice(start,start+size);if(parts.some(w=>w.length<3||!/[\p{L}]/u.test(w)||['para','das','dos','uma','uns','meu','minha','pelo','pela'].includes(w)))continue;
   const phrase=parts.join(' ');if(seen.has(phrase))continue;seen.add(phrase);
   if(!candidates.has(phrase))candidates.set(phrase,new Map());
   const counts=candidates.get(phrase);counts.set(category,(counts.get(category)||0)+1);
  }
 }
 return [...candidates].filter(([,counts])=>counts.size===1&&[...counts.values()][0]>=3)
  .map(([phrase,counts])=>({phrase,category:[...counts.keys()][0],examples:[...counts.values()][0]}))
  .sort((a,b)=>b.examples-a.examples||b.phrase.length-a.phrase.length||a.phrase.localeCompare(b.phrase)).slice(0,20);
}
