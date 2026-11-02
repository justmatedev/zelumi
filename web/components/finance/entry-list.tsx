'use client';
import {ArrowDownLeft,ArrowUpRight} from 'lucide-react';
import {brl,formatDate,type Entry} from '@/lib/finance';
export function EntryList({items,onOpen,emptyMessage='Tente outro nome ou amplie os filtros.'}:{items:Entry[];onOpen:(id:string)=>void;emptyMessage?:string}){
 if(!items.length)return <div className="finance-empty"><strong>Nenhum lançamento encontrado.</strong><p>{emptyMessage}</p></div>;
 return <div className="entry-list">{items.map(r=><button className="entry-row" key={`${r.recordId}:${r.installment}`} onClick={()=>onOpen(r.recordId)}><span className={`entry-icon ${r.type}`}>{r.type==='receita'?<ArrowDownLeft size={17} aria-hidden="true"/>:<ArrowUpRight size={17} aria-hidden="true"/>}</span><span className="entry-description"><strong>{r.description}</strong><small>{r.category} <span>· {formatDate(r.date)}</span></small></span><span className="entry-summary"><span className={`entry-amount ${r.type}`}>{r.type==='receita'?'+':'−'} {brl(r.amount)}</span><span className="entry-part">{r.installments>1?`Parcela ${r.installment} de ${r.installments}`:'À vista'}</span></span></button>)}</div>;
}
