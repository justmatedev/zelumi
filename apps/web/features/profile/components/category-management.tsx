'use client';
import {useEffect,useRef,useState} from 'react';
import {expenseCategories} from '@zelumi/finance/model';
import {useSession} from '@/features/auth/providers/session-provider';
import {useFinance} from '@/features/finance/hooks/use-finance';
import {api,ApiError} from '@/lib/api';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Field,Input} from '@/components/ui/input';
import {Select} from '@/components/ui/select';
import {SegmentedControl} from '@/components/ui/segmented-control';

type Association={key:string;category:string;revision:number};
type Listing={items:Association[];nextPage:number|null;suggestions:{phrase:string;category:string;examples:number}[]};
type Operation={path:string;method:'PUT'|'DELETE';key:string;body:{key:string;category?:string;expectedRevision:number|null}};

export function CategoryManagement(){
 const {csrfToken,expire}=useSession();
 const [resource,setResource]=useState<'memory'|'terms'>('memory'),[page,setPage]=useState(0),[editing,setEditing]=useState<Association|null>(null);
 const [phrase,setPhrase]=useState(''),[category,setCategory]=useState('Alimentação'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [uncertain,setUncertain]=useState<Operation|null>(null),[retryAllowed,setRetryAllowed]=useState(false);
 const identity=useRef(csrfToken),alive=useRef(true),sequence=useRef(0);identity.current=csrfToken;
 const path=resource==='memory'?'/api/finance/category-memory':'/api/finance/category-terms';
 const q=useFinance<Listing>(`${path}?page=${page}`),blocked=busy||!!uncertain;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;++sequence.current;};},[]);
 useEffect(()=>{++sequence.current;setUncertain(null);setBusy(false);setError('');setNotice('');setEditing(null);setPhrase('');setPage(0);},[csrfToken]);
 const current=(seq:number,token:string|null)=>alive.current&&sequence.current===seq&&identity.current===token;
 function success(){setUncertain(null);setEditing(null);setPhrase('');setError('');setNotice('Associação atualizada.');q.refresh();}
 async function run(op:Operation){
  const seq=++sequence.current,token=csrfToken;setBusy(true);setError('');setNotice('');setRetryAllowed(false);
  try{await api(op.path,{method:op.method,body:op.body,csrf:token||'',operationKey:op.key});if(current(seq,token))success();}
  catch(e){if(!current(seq,token))return;if(e instanceof ApiError&&e.status===401){expire();return;}if(!(e instanceof ApiError)||e.status>=500||e.status===0){setUncertain(op);setError('A resposta não chegou. Verifique o resultado antes de reenviar.');}else{setUncertain(null);setError(e.message);q.refresh();}}
  finally{if(current(seq,token))setBusy(false);}
 }
 async function reconcile(){
  if(!uncertain)return;const seq=++sequence.current,token=csrfToken;setBusy(true);
  try{const result=await api<{found:boolean}>(`/api/finance/operations/${uncertain.key}`);if(!current(seq,token))return;if(result.found)success();else{setRetryAllowed(true);setError('A ação ainda não foi confirmada. Você pode reenviar a mesma ação.');}}
  catch(e){if(!current(seq,token))return;if(e instanceof ApiError&&e.status===401){expire();return;}setError('Não foi possível verificar o resultado. Tente novamente.');}
  finally{if(current(seq,token))setBusy(false);}
 }
 function mutate(method:'PUT'|'DELETE',key:string,value:string|undefined,revision:number|null){void run({path,method,key:crypto.randomUUID(),body:{key,...(method==='PUT'?{category:value}:{}),expectedRevision:revision}});}
 function edit(item:Association){setEditing(item);setPhrase(item.key);setCategory(item.category);setNotice('');setError('');}
 return <Card>
  <h2>Categorias aprendidas</h2>
  <p className="card-description">Suas escolhas ajudam a classificar os próximos lançamentos. As associações são exclusivas da sua conta.</p>
  <div className="category-management">
   <SegmentedControl aria-label="Tipo de associação" value={resource} disabled={blocked} options={[{value:'memory',label:'Descrições'},{value:'terms',label:'Termos'}]} onValueChange={value=>{setResource(value as 'memory'|'terms');setPage(0);setEditing(null);setPhrase('');setError('');setNotice('');}}/>
   <p className="card-description">{resource==='memory'?'Descrições iguais reaproveitam a categoria que você confirmou.':'Termos são palavras ou expressões que você escolhe reconhecer em outras descrições.'}</p>
   {(resource==='terms'||editing)&&<form className="record-form" onSubmit={e=>{e.preventDefault();mutate('PUT',phrase,category,editing?.revision??null);}}>
    <fieldset disabled={blocked}><Field label={resource==='terms'?'Termo ou expressão':'Descrição'} id="learned-phrase"><Input id="learned-phrase" value={phrase} readOnly={!!editing} required maxLength={resource==='terms'?100:500} onChange={e=>setPhrase(e.target.value)}/></Field>
    <Field label="Categoria da associação" id="learned-category"><Select id="learned-category" aria-labelledby="learned-category-label" value={category} disabled={blocked} onValueChange={setCategory} options={expenseCategories.map(c=>({value:c,label:c}))}/></Field></fieldset>
    <div className="dialog-actions">{editing&&<Button type="button" variant="ghost" disabled={blocked} onClick={()=>{setEditing(null);setPhrase('');}}>Cancelar edição</Button>}<Button type="submit" disabled={blocked||!phrase.trim()}>{busy?'Salvando…':editing?'Salvar associação':'Adicionar termo'}</Button></div>
   </form>}
   {q.loading&&!q.data&&<p role="status">Carregando associações…</p>}
   {q.error&&<div role="alert"><p className="error-message">{q.error.message}</p><Button variant="outline" disabled={blocked} onClick={q.refresh}>Tentar novamente</Button></div>}
   {q.data&&!q.data.items?.length&&<p className="card-description">{resource==='memory'?'Ao corrigir uma categoria no editor, marque a opção para lembrar a descrição.':'Você ainda não confirmou termos pessoais.'}</p>}
   <ul className="category-associations">{q.data?.items?.map(item=><li key={item.key}><div><strong>{item.key}</strong><span>{item.category}</span></div><div className="dialog-actions"><Button variant="ghost" disabled={blocked} aria-label={`Editar associação ${item.key}`} onClick={()=>edit(item)}>Editar</Button><Button variant="ghost" disabled={blocked} aria-label={`Esquecer associação ${item.key}`} onClick={()=>mutate('DELETE',item.key,undefined,item.revision)}>Esquecer</Button></div></li>)}</ul>
   {(page>0||q.data?.nextPage!=null)&&<div className="dialog-actions"><Button variant="ghost" disabled={blocked||page===0} onClick={()=>setPage(v=>v-1)}>Página anterior</Button><Button variant="ghost" disabled={blocked||q.data?.nextPage==null} onClick={()=>setPage(q.data!.nextPage!)}>Próxima página</Button></div>}
   {resource==='terms'&&!!q.data?.suggestions?.length&&<div><h3>Sugestões das suas correções</h3><p className="card-description">Cada sugestão aparece em pelo menos três descrições que você confirmou. Ela só passa a valer quando você aceitar.</p><ul className="category-associations">{q.data.suggestions.map(item=><li key={item.phrase}><div><strong>{item.phrase}</strong><span>{item.category} · {item.examples} descrições</span></div><Button variant="outline" disabled={blocked} aria-label={`Confirmar termo ${item.phrase}`} onClick={()=>mutate('PUT',item.phrase,item.category,null)}>Confirmar termo</Button></li>)}</ul></div>}
   {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="error-message">{error}</p>}
   {uncertain&&<div className="dialog-actions"><Button variant="outline" disabled={busy} onClick={()=>void reconcile()}>Verificar resultado</Button><Button disabled={busy||!retryAllowed} onClick={()=>void run(uncertain)}>Reenviar mesma ação</Button></div>}
  </div>
 </Card>;
}
