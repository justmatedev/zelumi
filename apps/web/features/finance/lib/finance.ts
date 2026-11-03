import type {EditFields,Occurrence} from '@zelumi/finance/model';
export type {EditFields};
export type RecordDetail=EditFields&{id:string;version:string;schedule:Occurrence[]};
export type Entry={recordId:string;installment:number;installments:number;date:string;month:string;amount:number;totalAmount:number;description:string;type:'receita'|'despesa';category:string};
export type OverviewData={month:string;snapshot:number;income:number;expense:number;installmentExpense:number;cashExpense:number;result:number;count:number;categories:{category:string;amount:number}[];recent:Entry[]};
export type EntriesData={items:Entry[];total:number;page:number;pageSize:number;snapshot:number;categories:string[]};
export const brl=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export const formatDate=(date:string)=>date.split('-').reverse().join('/');
export const currentMonth=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date());
export function monthLabel(month:string){const [y,m]=month.split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,1)));}
export const editFields=(r:EditFields):EditFields=>({description:r.description,type:r.type,category:r.category,amount:r.amount,date:r.date,installments:r.installments,installmentStartMonth:r.installmentStartMonth??null});
