export type EditFields={description:string;type:'receita'|'despesa';category:string;amount:number;date:string;installments:number;installmentStartMonth:string|null};
export type Occurrence={date:string;amount:number};
export class FinanceError extends Error {code:string;status:number;constructor(code:string,message:string,status?:number);}
export const expenseCategories:string[];
export const categories:string[];
export function normalizeSearch(s:string):string;
export function validMonth(s:unknown,maximum?:number):boolean;
export function validDate(s:unknown,maximum?:number):boolean;
export function validateEdit(value:unknown):EditFields;
export function schedule(value:EditFields):Occurrence[];
export function readStored(body:string):EditFields&{schedule:Occurrence[]};
export function safeTotals<T>(row:T):T;
