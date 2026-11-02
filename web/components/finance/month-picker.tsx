'use client';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {monthLabel} from '@/lib/finance';
export function MonthPicker({value,onChange}:{value:string;onChange:(v:string)=>void}){
 function move(delta:number){const [y,m]=value.split('-').map(Number),d=new Date(Date.UTC(y,m-1+delta,1));if(d.getUTCFullYear()<1900||d.getUTCFullYear()>9999)return;onChange(d.toISOString().slice(0,7));}
 return <div className="month-picker"><button aria-label="Mês anterior" onClick={()=>move(-1)}><ChevronLeft size={17}/></button><label><span>{monthLabel(value)}</span><input type="month" aria-label="Selecionar mês" min="1900-01" max="9999-12" value={value} onChange={e=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))onChange(e.target.value);}}/></label><button aria-label="Próximo mês" onClick={()=>move(1)}><ChevronRight size={17}/></button></div>;
}
