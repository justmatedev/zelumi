'use client';
import {useEffect,useRef,useState} from 'react';
import {X,Pencil,Trash2} from 'lucide-react';
import {api,ApiError} from '@/lib/api';
import {useFinance} from '@/features/finance/hooks/use-finance';
import {useModalScrollLock,useDialogBackdrop} from '@/hooks/use-modal';
import {useSession} from '@/features/auth/providers/session-provider';
import {Button} from '@/components/ui/button';
import {IconButton} from '@/components/ui/icon-button';
import {RecordEditor} from './record-editor';
import {brl,formatDate,type EditFields,type RecordDetail,type CategoryMemoryAction} from '@/features/finance/lib/finance';
type Operation={method:'PUT'|'DELETE';key:string;expectedVersion:string;record?:EditFields;categoryMemoryAction?:CategoryMemoryAction};
export function RecordDialog({id,onClose,onChanged}:{id:string|null;onClose:()=>void;onChanged:()=>void}){
 const {csrfToken,expire,status}=useSession();
 const ref=useRef<HTMLDialogElement>(null),alive=useRef(true),opSequence=useRef(0),origin=useRef<HTMLElement|null>(null),identity=useRef(csrfToken);
 const [record,setRecord]=useState<RecordDetail|null>(null),[mode,setMode]=useState<'view'|'edit'|'delete'>('view'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState<Operation|null>(null),[retryAllowed,setRetryAllowed]=useState(false);
 useModalScrollLock(!!id&&status==='authenticated'&&(identity.current===null||identity.current===csrfToken));
 const backdrop=useDialogBackdrop(onClose,busy);
 const q=useFinance<RecordDetail>(id&&mode==='view'?`/api/finance/records/${id}`:null);
 useEffect(()=>{if(q.data)setRecord(q.data);},[q.data]);
 useEffect(()=>{alive.current=true;if(id&&status==='authenticated'&&ref.current){origin.current=document.activeElement as HTMLElement;ref.current.showModal();}return()=>{alive.current=false;++opSequence.current;origin.current?.focus();};},[id,status]);
 useEffect(()=>{if(status!=='authenticated'){++opSequence.current;setRecord(null);setUncertain(null);}},[status]);
 useEffect(()=>{if(identity.current===null&&csrfToken){identity.current=csrfToken;return;}if(identity.current!==csrfToken){++opSequence.current;setRecord(null);setUncertain(null);setError('');onClose();}},[csrfToken]);
 function finish(){onChanged();onClose();}
 async function run(op:Operation){
  const seq=++opSequence.current;setBusy(true);setRetryAllowed(false);setError('');
  try{await api(`/api/finance/records/${id}`,{method:op.method,body:{expectedVersion:op.expectedVersion,...(op.method==='PUT'?{record:op.record,categoryMemoryAction:op.categoryMemoryAction||'keep'}:{})},csrf:csrfToken||'',operationKey:op.key});if(alive.current&&opSequence.current===seq)finish();}
  catch(e){if(!alive.current||opSequence.current!==seq)return;if(e instanceof ApiError&&e.status===401){expire();return;}
   if(!(e instanceof ApiError)||e.status>=500||e.status===0){setUncertain(op);setError('A resposta não chegou. Verifique o resultado antes de reenviar a mesma ação.');}
   else {setUncertain(null);setError(e instanceof Error?e.message:'Não foi possível concluir.');}}
  finally{if(alive.current&&opSequence.current===seq)setBusy(false);}
 }
 async function reconcile(){if(!uncertain)return;setBusy(true);const seq=++opSequence.current;
  try{const receipt=await api<{found:boolean}>(`/api/finance/operations/${uncertain.key}`);if(!alive.current||seq!==opSequence.current)return;
   if(receipt.found){finish();return;}
   const current=await api<RecordDetail>(`/api/finance/records/${id}`);if(!alive.current||seq!==opSequence.current)return;
   if(current.version!==uncertain.expectedVersion){setUncertain(null);setError('O lançamento foi alterado. Recarregue antes de continuar.');}
   else {setRetryAllowed(true);setError('A ação ainda não aparece no registro. Você pode reenviar a mesma ação com segurança.');}
  }catch(e){if(!alive.current||seq!==opSequence.current)return;if(e instanceof ApiError&&e.status===401){expire();return;}if(e instanceof ApiError&&e.status===404&&uncertain.method==='DELETE'){finish();return;}setError('Não foi possível verificar o resultado. Tente verificar novamente.');}
  finally{if(alive.current&&seq===opSequence.current)setBusy(false);}
 }
 if(!id||status!=='authenticated'||identity.current!==null&&identity.current!==csrfToken)return null;
 return <dialog ref={ref} {...backdrop} className="record-dialog" aria-labelledby="record-title" onCancel={e=>{if(busy)e.preventDefault();else onClose();}} onClose={onClose}><header><p className="eyebrow">{mode==='edit'?'EDITAR LANÇAMENTO':mode==='delete'?'EXCLUIR LANÇAMENTO':'DETALHES DO LANÇAMENTO'}</p><IconButton onClick={onClose} disabled={busy} aria-label="Fechar detalhes"><X size={20}/></IconButton></header><h2 id="record-title">{record?.description||'Lançamento'}</h2>{!record&&<div className="finance-state">{q.loading?'Carregando detalhes…':q.error?.message||'Não foi possível carregar.'}{q.error&&<Button variant="outline" onClick={q.refresh}>Tentar novamente</Button>}</div>}{record&&mode==='view'&&<><p className="detail-amount">{brl(record.amount)} <small>valor total</small></p><dl className="account-facts"><div><dt>Tipo</dt><dd>{record.type==='receita'?'Receita':'Despesa'}</dd></div><div><dt>Categoria</dt><dd>{record.category}</dd></div><div><dt>Data da compra</dt><dd>{formatDate(record.date)}</dd></div><div><dt>Parcelas</dt><dd>{record.installments}</dd></div></dl><details className="schedule-preview"><summary>Ver parcelas por mês</summary><ol>{record.schedule.map((r,i)=><li key={r.date}><span>{i+1}/{record.installments} · {formatDate(r.date)}</span><strong>{brl(r.amount)}</strong></li>)}</ol></details><div className="dialog-actions"><Button variant="outline" onClick={()=>{setError('');setMode('delete');}}><Trash2 size={15}/>Excluir</Button><Button onClick={()=>{setError('');setMode('edit');}}><Pencil size={15}/>Editar</Button></div></>}{record&&mode==='edit'&&<RecordEditor record={record} busy={busy||!!uncertain} onCancel={()=>setMode('view')} onSave={(value,categoryMemoryAction)=>run({method:'PUT',key:crypto.randomUUID(),expectedVersion:record.version,record:value,categoryMemoryAction})}/ >}{record&&mode==='delete'&&<><p className="form-warning">Excluir “{record.description}”, total de {brl(record.amount)}? Todas as {record.installments} parcela(s) serão removidas, inclusive de meses anteriores.</p><div className="dialog-actions"><Button variant="outline" disabled={busy||!!uncertain} onClick={()=>setMode('view')}>Voltar</Button><Button disabled={busy||!!uncertain} onClick={()=>void run({method:'DELETE',key:crypto.randomUUID(),expectedVersion:record.version})}>{busy?'Excluindo…':'Confirmar exclusão'}</Button></div></>}{error&&<p role="alert" className="error-message">{error}</p>}{uncertain&&<div className="dialog-actions"><Button variant="outline" disabled={busy} onClick={()=>void reconcile()}>Verificar resultado</Button><Button disabled={busy||!retryAllowed} onClick={()=>void run(uncertain)}>Reenviar mesma ação</Button></div>}{error&&!uncertain&&record&&<Button variant="ghost" onClick={()=>{setMode('view');q.refresh();setError('');}}>Recarregar dados atuais</Button>}</dialog>;
}
