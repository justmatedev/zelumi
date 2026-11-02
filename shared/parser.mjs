import {classifyExpense} from './categories.mjs';
const clean = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function money(s) {
  if (!/^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(s) && !/^\d+\.\d{1,2}$/.test(s)) return null;
  const n = s.includes(',') ? Number(s.replaceAll('.', '').replace(',', '.')) : /^\d{1,3}(\.\d{3})+$/.test(s) ? Number(s.replaceAll('.', '')) : Number(s);
  const cents = Math.round(n * 100);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100000000000 ? cents : null;
}
export function parse(text, now = new Date()) {
  text = text.trim(); const normalized = clean(text);
  const date = new Date(now); if (/\bontem\b/.test(normalized)) date.setDate(date.getDate()-1);
  const day = [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  if (!text || text.length > 500) return {status:'invalid', question:'Envie uma mensagem com até 500 caracteres, como “pão 10”.'};
  if (/\b(amanha|anteontem|semana|mes passado|dia\s+\d)|\d{1,2}[/:-]\d{1,2}/.test(normalized)) return {status:'invalid',question:'Neste protótipo, use “hoje” ou “ontem” para a data.'};
  if (/\b(transferi|transferencia|paguei a fatura|pagar fatura)\b/.test(normalized)) return {status:'invalid',question:'Transferências e pagamentos de fatura ainda não estão disponíveis. Teste uma compra ou receita.'};
  if (/-\s*\d/.test(text)) return {status:'invalid',question:'Use um valor positivo. Para entradas, escreva “recebi”, por exemplo “recebi 200”.'};
  const tokens = [...text.matchAll(/\d+(?:\.\d{3})*(?:[,.]\d{1,2})?/g)];
  let installments = 1, total = null;
  // x12 é um marcador de quantidade após o valor total; 12x precede
  // o valor de cada parcela. Distinguir o lado do x evita trocar os números.
  const suffix = normalized.match(/\bx(\d+)\b/);
  const per = normalized.match(/(\d+)\s*x\s*(?:de\s*)?(?:r\$\s*)?(\d+(?:\.\d{3})*(?:[,.]\d{1,2})?)/);
  const split = normalized.match(/(?:em\s+)?(\d+)\s*(?:x\b|vezes\b|parcelas\b)/);
  if (suffix) { installments=Number(suffix[1]); const remaining = normalized.replace(suffix[0], '').match(/\d+(?:\.\d{3})*(?:[,.]\d{1,2})?/g) || []; if(remaining.length===1) total=money(remaining[0]); }
  else if (per) { installments=Number(per[1]); const unit=money(per[2]); total=unit ? unit*installments : null; }
  else if (split) { installments=Number(split[1]); const remaining = normalized.replace(split[0], '').match(/\d+(?:\.\d{3})*(?:[,.]\d{1,2})?/g) || []; if(remaining.length===1) total=money(remaining[0]); }
  if (installments < 1 || installments > 120) return {status:'invalid',question:'Use entre 1 e 120 parcelas.'};
  let description = text.replace(/\bx\d+\b/gi,'').replace(/(?:em\s+)?\d+\s*(?:x|vezes|parcelas)\b/gi,'').replace(/\d+(?:\.\d{3})*(?:[,.]\d{1,2})?/g,'').replace(/r\$/gi,'').replace(/(?<![\p{L}\p{M}\p{N}_])(hoje|ontem|gastei|paguei|comprei|recebi|ganhei|reais|real|por|em|no|na|com|de|da|do|venda|uns)(?![\p{L}\p{M}\p{N}_])/giu,' ').replace(/\s+/g,' ').trim();
  if (!description) return {status:'missing_description',question:'Com o que foi esse lançamento? Ex.: “pão 10”.'};
  const type = /\b(recebi|ganhei|salario|reembolso)\b/.test(normalized) ? 'receita' : 'despesa';
  const category = type==='receita' ? 'Receitas' : classifyExpense(description);
  const base = {description:description[0].toUpperCase()+description.slice(1),type,category,date:day,installments,original:text};
  const installmentOnly = (suffix || split) && tokens.length===1;
  if (!tokens.length || installmentOnly) return {...base,status:'missing_amount',question:`Qual foi o valor de ${description}?`};
  if (tokens.length > (suffix || per || split ? 2 : 1)) return {...base,status:'ambiguous',question:'Encontrei mais de um número. Qual foi o valor total, em reais?'};
  if (!suffix && !per && !split) total=money(tokens[0][0]);
  if (!total || !Number.isSafeInteger(total) || total>100000000000) return {...base,status:'invalid',question:'Informe um valor positivo válido, como “pão 10,50”.'};
  if (/\b(uns|aproximadamente|cerca)\b/.test(normalized)) return {...base,status:'ambiguous',question:'Qual foi o valor exato, em reais?'};
  return {...base,status:'ready',amount:total};
}
export function resolve(pending, answer) {
  const value=money(answer.trim().replace(/^r\$\s*/i,''));
  if (!value) return {...pending,question:'Responda apenas com o valor total, como “10,50”, ou cancele.'};
  return {...pending,status:'ready',amount:value};
}
export function schedule(record) {
  const d=Number(record.date.slice(8,10));
  const [y,m]=(record.installments>1&&record.installmentStartMonth?record.installmentStartMonth:record.date.slice(0,7)).split('-').map(Number);
  const base=Math.floor(record.amount/record.installments), remainder=record.amount%record.installments;
  return Array.from({length:record.installments},(_,i)=>{
    const last=new Date(y,m+i,0).getDate();
    return {amount:base+(i<remainder?1:0),date:`${y+Math.floor((m-1+i)/12)}-${String((m-1+i)%12+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`};
  });
}
