'use client';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {MonthField} from '@/components/ui/date-field';
import {IconButton} from '@/components/ui/icon-button';
export function MonthPicker({value,onChange}:{value:string;onChange:(v:string)=>void}){
 function move(delta:number){const [y,m]=value.split('-').map(Number),d=new Date(Date.UTC(y,m-1+delta,1));if(d.getUTCFullYear()<1900||d.getUTCFullYear()>9999)return;onChange(d.toISOString().slice(0,7));}
 return <div className="month-picker"><IconButton aria-label="Mês anterior" disabled={value==='1900-01'} onClick={()=>move(-1)}><ChevronLeft size={17}/></IconButton><MonthField aria-label="Selecionar mês" value={value} onValueChange={onChange}/><IconButton aria-label="Próximo mês" disabled={value==='9999-12'} onClick={()=>move(1)}><ChevronRight size={17}/></IconButton></div>;
}
