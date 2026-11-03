'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {RefreshCw,ArrowDownLeft,ArrowUpRight,Wallet} from 'lucide-react';
import {useFinance} from '@/features/finance/hooks/use-finance';
import {brl,currentMonth,type OverviewData} from '@/features/finance/lib/finance';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {MonthPicker} from './month-picker';
import {CategoryChart} from './category-chart';
import {EntryList} from './entry-list';
import {RecordDialog} from './record-dialog';
export function Overview(){const [month,setMonth]=useState(''),[selected,setSelected]=useState<string|null>(null);useEffect(()=>setMonth(currentMonth()),[]);
 const q=useFinance<OverviewData>(month?`/api/finance/overview?month=${month}`:null),d=q.data;
 return <><div className="finance-heading overview-heading"><div className="page-heading"><p className="eyebrow">SEU DINHEIRO, COM CLAREZA</p><h1>Visão geral</h1><p>Receitas, despesas e parcelas do seu mês.</p></div><div className="overview-controls">{month&&<MonthPicker value={month} onChange={setMonth}/>}<Button variant="ghost" onClick={q.refresh} aria-label="Atualizar" title="Atualizar dados do mês"><RefreshCw size={16} aria-hidden="true"/><span className="overview-refresh-label">Atualizar</span></Button></div></div>{!d?<Card className="finance-state" role="status"><strong>{q.loading?'Carregando seu mês…':q.error?.message||'Preparando sua visão geral…'}</strong>{q.error&&!q.loading&&<Button variant="outline" onClick={q.refresh}>Tentar novamente</Button>}</Card>:<><div className="finance-kpis">{[{label:'Receitas do mês',value:d.income,Icon:ArrowDownLeft,note:'Entradas atribuídas ao período.',className:'receita'},{label:'Despesas do mês',value:d.expense,Icon:ArrowUpRight,note:<><span>Parcelas: {brl(d.installmentExpense)}</span><span>À vista: {brl(d.cashExpense)}</span></>,className:'despesa'},{label:'Resultado do mês',value:d.result,Icon:Wallet,note:'Receitas menos despesas deste mês.',className:'resultado'}].map(({label,value,Icon,note,className})=><Card className={`finance-kpi ${className}`} key={label}><div><span><Icon size={16}/></span>{label}</div><strong>{brl(value)}</strong><p className="finance-kpi-note">{note}</p></Card>)}</div><div className="finance-middle"><Card><h2>Para onde foi seu dinheiro</h2><p className="card-description">Despesas por categoria neste mês.</p><CategoryChart items={d.categories}/></Card><Card className="finance-transactions"><div className="card-heading"><h2>Últimos lançamentos</h2><Link href="/lancamentos/">Ver todos →</Link></div><p className="card-description">Os movimentos que compõem seu mês.</p><EntryList items={d.recent} onOpen={setSelected} emptyMessage="Os lançamentos deste mês aparecerão aqui."/><div className="table-note">{d.count} ocorrência(s) no período · valores referentes ao mês</div></Card></div><p className="finance-note">Compra parcelada? Aqui entra só a parcela deste mês. O valor total continua nos detalhes.</p></>}<RecordDialog key={selected||'closed'} id={selected} onClose={()=>setSelected(null)} onChanged={q.refresh}/></>;
}
