'use client';
import {useEffect,useState} from 'react';
import {Search,SlidersHorizontal,RefreshCw,ChevronLeft,ChevronRight} from 'lucide-react';
import {useFinance} from '@/features/finance/hooks/use-finance';
import {type EntriesData} from '@/features/finance/lib/finance';
import {categories} from '@zelumi/finance/model';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {IconButton} from '@/components/ui/icon-button';
import {Input,Field} from '@/components/ui/input';
import {Select} from '@/components/ui/select';
import {MonthField} from '@/components/ui/date-field';
import {EntryList} from './entry-list';
import {RecordDialog} from './record-dialog';
export function History(){
 const [draft,setDraft]=useState(''),[qtext,setQtext]=useState(''),[filters,setFilters]=useState({month:'',type:'',category:'',parts:'all'}),[open,setOpen]=useState(false),[page,setPage]=useState(1),[snapshot,setSnapshot]=useState<number>(),[selected,setSelected]=useState<string|null>(null),[notice,setNotice]=useState('');
 useEffect(()=>{const t=setTimeout(()=>{setQtext(draft);setPage(1);setSnapshot(undefined);},300);return()=>clearTimeout(t);},[draft]);
 const params=new URLSearchParams({page:String(page),q:qtext,parts:filters.parts});for(const [key,value] of Object.entries(filters))if(value)params.set(key,value);if(page>1&&snapshot!==undefined)params.set('snapshot',String(snapshot));
 const q=useFinance<EntriesData>('/api/finance/entries?'+params),d=q.data;
 useEffect(()=>{if(d&&page===1)setSnapshot(d.snapshot);},[d,page]);
 useEffect(()=>{if(q.error?.code==='HISTORY_CHANGED'){setNotice(q.error.message);setPage(1);setSnapshot(undefined);}},[q.error]);
 function change(key:keyof typeof filters,value:string){setFilters(f=>({...f,[key]:value}));setPage(1);setSnapshot(undefined);setNotice('');}
 function changed(){setPage(1);setSnapshot(undefined);q.refresh();}
 return <>
  <div className="finance-heading"><div className="page-heading"><p className="eyebrow">SEUS REGISTROS, ORGANIZADOS</p><h1>Lançamentos</h1><p>Encontre uma compra sem precisar lembrar a data.</p></div><Button variant="ghost" onClick={q.refresh}><RefreshCw size={14}/>Atualizar</Button></div>
  <Card className="search-panel">
   <div className="search-main"><div className="search-field"><label className="field-label" htmlFor="finance-search">Buscar pelo nome</label><div className="purchase-search"><Search size={18} aria-hidden="true"/><Input id="finance-search" aria-label="Buscar pelo nome da compra ou receita" placeholder="Busque pelo nome: Google, mercado, Uber…" maxLength={100} value={draft} onChange={e=>setDraft(e.target.value)}/>{draft&&<IconButton aria-label="Limpar busca" onClick={()=>setDraft('')}>×</IconButton>}</div></div><Button variant="outline" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><SlidersHorizontal size={15}/>Filtros</Button></div>
   <p className="search-hint">Comece pelo nome da compra. {filters.month?'Busca limitada ao mês selecionado.':'A busca inclui todos os meses.'}</p>
   {open&&<div className="finance-filters">
    <Field label="Período" id="filter-month" hint="Sem seleção: todos os meses"><MonthField id="filter-month" aria-label="Filtrar mês" aria-describedby="filter-month-hint" value={filters.month} clearable min="1900-01" max="9999-12" onValueChange={value=>change('month',value)}/></Field>
    <Field label="Tipo" id="filter-type"><Select id="filter-type" aria-labelledby="filter-type-label" value={filters.type} onValueChange={value=>change('type',value)} options={[{value:'',label:'Receitas e despesas'},{value:'despesa',label:'Despesas'},{value:'receita',label:'Receitas'}]}/></Field>
    <Field label="Categoria" id="filter-category"><Select id="filter-category" aria-labelledby="filter-category-label" value={filters.category} onValueChange={value=>change('category',value)} options={[{value:'',label:'Todas as categorias'},...categories.map(c=>({value:c,label:c}))]}/></Field>
    <Field label="Parcelamento" id="filter-parts"><Select id="filter-parts" aria-labelledby="filter-parts-label" value={filters.parts} onValueChange={value=>change('parts',value)} options={[{value:'all',label:'Todos os lançamentos'},{value:'yes',label:'Parcelados'},{value:'no',label:'Não parcelados'}]}/></Field>
    <Button variant="ghost" onClick={()=>{setDraft('');setFilters({month:'',type:'',category:'',parts:'all'});setPage(1);setSnapshot(undefined);}}>Limpar filtros</Button>
   </div>}
   <div className="search-count" aria-live="polite"><span>{d?`${d.total} resultado(s) encontrado(s)`:'Consultando seu histórico…'}</span><span>Cada parcela no seu respectivo mês.</span></div>
  </Card>
  {notice&&<p role="status" className="finance-note">{notice}</p>}
  <Card className="finance-transactions"><h2>Todos os lançamentos</h2><p className="card-description">Abra um registro para consultar ou editar a compra inteira.</p>
   {d?<><EntryList items={d.items} onOpen={setSelected}/><div className="table-note"><span>{d.total?((page-1)*20+1):0}–{Math.min(page*20,d.total)} de {d.total}</span><div className="pagination"><IconButton aria-label="Página anterior" disabled={page===1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={16}/></IconButton><span>{page} / {Math.max(1,Math.ceil(d.total/20))}</span><IconButton aria-label="Próxima página" disabled={page*20>=d.total} onClick={()=>setPage(p=>p+1)}><ChevronRight size={16}/></IconButton></div></div></>:<div className="finance-state" role="status">{q.loading?'Carregando lançamentos…':q.error?.message}{q.error&&!q.loading&&<Button variant="outline" onClick={q.refresh}>Tentar novamente</Button>}</div>}
  </Card>
  <RecordDialog key={selected||'closed'} id={selected} onClose={()=>setSelected(null)} onChanged={changed}/>
 </>;
}
