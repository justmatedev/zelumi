'use client';
import {ArrowDownLeft,ArrowUpRight} from 'lucide-react';
import {brl,formatDate,type Entry} from '@/lib/finance';
export function EntryList({items,onOpen}:{items:Entry[];onOpen:(id:string)=>void}){
 if(!items.length)return <div className="finance-empty"><strong>Nenhum lançamento encontrado.</strong><p>Tente outro nome ou amplie os filtros.</p></div>;
 return <div className="entry-list">{items.map(r=><button className="entry-row" key={`${r.recordId}:${r.installment}`} onClick={()=>onOpen(r.recordId)}><span className={`entry-icon ${r.type}`}>{r.type==='receita'?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}</span><span className="entry-description"><strong>{r.description}</strong><small>{r.category} <span>· {formatDate(r.date)}</span></small></span><span className="entry-part">{r.installments>1?`${r.installment}/${r.installments}`:'À vista'}</span><span className={`entry-amount ${r.type}`}>{r.type==='receita'?'+':'−'} {brl(r.amount)}</span></button>)}</div>;
}
