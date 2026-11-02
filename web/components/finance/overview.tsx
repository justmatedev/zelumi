'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {RefreshCw,ArrowDownLeft,ArrowUpRight,Wallet} from 'lucide-react';
import {useFinance} from '@/hooks/use-finance';
import {brl,currentMonth,type OverviewData} from '@/lib/finance';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {MonthPicker} from './month-picker';
import {CategoryChart} from './category-chart';
import {EntryList} from './entry-list';
import {RecordDialog} from './record-dialog';
export function Overview(){const [month,setMonth]=useState(''),[selected,setSelected]=useState<string|null>(null);useEffect(()=>setMonth(currentMonth()),[]);
 const q=useFinance<OverviewData>(month?`/api/finance/overview?month=${month}`:null),d=q.data;
 return <><div className="finance-heading"><div className="page-heading"><p className="eyebrow">SEU DINHEIRO, COM CLAREZA</p><h1>Visão geral</h1><p>Receitas, despesas e parcelas do seu mês.</p></div>{month&&<MonthPicker value={month} onChange={setMonth}/>}</div><div className="finance-toolbar"><Button variant="ghost" onClick={q.refresh}><RefreshCw size={14}/>Atualizar</Button></div>{!d?<Card className="finance-state" role="status"><strong>{q.loading?'Carregando seu mês…':q.error?.message||'Preparando sua visão geral…'}</strong>{q.error&&!q.loading&&<Button variant="outline" onClick={q.refresh}>Tentar novamente</Button>}</Card>:<><div className="finance-kpis">{[{label:'Receitas do mês',value:d.income,Icon:ArrowDownLeft,note:'Entradas atribuídas ao período.',className:'receita'},{label:'Despesas do mês',value:d.expense,Icon:ArrowUpRight,note:`${brl(d.installmentExpense)} em parcelas · ${brl(d.cashExpense)} à vista`,className:'despesa'},{label:'Resultado do mês',value:d.result,Icon:Wallet,note:'Receitas menos despesas deste mês.',className:'resultado'}].map(({label,value,Icon,note,className})=><Card className={`finance-kpi ${className}`} key={label}><div><span><Icon size={16}/></span>{label}</div><strong>{brl(value)}</strong><p>{note}</p></Card>)}</div><div className="finance-middle"><Card><h2>Para onde foi seu dinheiro</h2><p className="card-description">Despesas por categoria neste mês.</p><CategoryChart items={d.categories}/></Card><Card className="finance-transactions"><div className="card-heading"><h2>Últimos lançamentos</h2><Link href="/lancamentos/">Ver todos →</Link></div><p className="card-description">Os movimentos que compõem seu mês.</p><EntryList items={d.recent} onOpen={setSelected}/><div className="table-note">{d.count} ocorrência(s) no período · valores referentes ao mês</div></Card></div><p className="finance-note">Compra parcelada? Aqui entra só a parcela deste mês. O valor total continua nos detalhes.</p></>}<RecordDialog key={selected||'closed'} id={selected} onClose={()=>setSelected(null)} onChanged={q.refresh}/></>;
}
