import {schedule} from './parser.mjs';
export {schedule};
import {expenseCategories} from './categories.mjs';
export {expenseCategories,categories} from './categories.mjs';
export class FinanceError extends Error {
 constructor(code,message,status=400){super(message);this.code=code;this.status=status;}
}
const invalid=message=>{throw new FinanceError('INVALID_RECORD',message);};
export const normalizeSearch=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
export function validMonth(value,maximum=9990){return typeof value==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&Number(value.slice(0,4))>=1900&&Number(value.slice(0,4))<=maximum;}
export function validDate(value,maximum=9990){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!validMonth(value.slice(0,7),maximum))return false;
 const [y,m,d]=value.split('-').map(Number);return d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate();
}
const fields=['description','type','category','amount','date','installments','installmentStartMonth'];
// Stored bot records include metadata and allow longer descriptions than edits.
function validate(value,{storedRecord=false}={}){
 if(!value||typeof value!=='object'||Array.isArray(value))invalid('Lançamento inválido.');
 if(!storedRecord&&Object.keys(value).some(k=>!fields.includes(k)))invalid('Campo não permitido.');
 if(typeof value.description!=='string'||!value.description.trim()||value.description.length>(storedRecord?500:200))invalid('Use um nome de até 200 caracteres.');
 if(!['receita','despesa'].includes(value.type)||!(value.type==='receita'?['Receitas']:expenseCategories).includes(value.category))invalid('Tipo ou categoria inválidos.');
 if(!Number.isSafeInteger(value.amount)||value.amount<=0||value.amount>100000000000)invalid('Informe um valor total positivo válido.');
 if(!validDate(value.date)||!Number.isInteger(value.installments)||value.installments<1||value.installments>120)invalid('Data ou quantidade de parcelas inválida.');
 const start=value.installments>1?(value.installmentStartMonth??null):null;
 if(start!==null&&!validMonth(start))invalid('Mês inicial inválido.');
 const r=Object.fromEntries(fields.map(k=>[k,k==='description'?value.description.trim():k==='installmentStartMonth'?start:value[k]]));
 if(Number(schedule(r).at(-1).date.slice(0,4))>9999)invalid('O cronograma ultrapassa o limite de datas.');
 return r;
}
export const validateEdit=value=>validate(value);
export function readStored(body){
 try{
  const source=JSON.parse(body),r=validate(source,{storedRecord:true});
  const rows=source.schedule===undefined?schedule(r):source.schedule;
  if(!Array.isArray(rows)||rows.length!==r.installments)invalid('Cronograma inválido.');
  let total=0,previous='';
  for(const row of rows){
   if(!row||!validDate(row.date,9999)||!Number.isSafeInteger(row.amount)||row.amount<0||row.date.slice(0,7)<=previous)invalid('Cronograma inválido.');
   total+=row.amount;previous=row.date.slice(0,7);
  }
  if(total!==r.amount||!Number.isSafeInteger(total))invalid('Total das parcelas inválido.');
  if(r.installments===1&&(rows[0].date!==r.date||rows[0].amount!==r.amount))invalid('Lançamento à vista inválido.');
  return {...r,schedule:rows};
 }catch{throw new FinanceError('HISTORY_INVALID','Um lançamento antigo precisa ser revisado antes de consultar o histórico.',503);}
}
export function safeTotals(row){for(const value of Object.values(row))if(typeof value==='number'&&!Number.isSafeInteger(value))throw new FinanceError('TOTAL_TOO_LARGE','O total excede o limite de cálculo seguro.',503);return row;}
