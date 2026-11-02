'use client';
import {useMemo,useState} from 'react';
import {expenseCategories,schedule,validateEdit} from '../../../finance/model.mjs';
import {money} from '../../../shared/parser.mjs';
import {brl,formatDate,editFields,type EditFields,type RecordDetail} from '@/lib/finance';
import {Button} from '@/components/ui/button';
import {Input,Field} from '@/components/ui/input';
import {Select} from '@/components/ui/select';
import {SegmentedControl} from '@/components/ui/segmented-control';
import {NumberField} from '@/components/ui/number-field';
import {DateField,MonthField} from '@/components/ui/date-field';
export function RecordEditor({record,onSave,onCancel,busy}:{record:RecordDetail;onSave:(value:EditFields)=>Promise<void>;onCancel:()=>void;busy:boolean}){
 const [draft,setDraft]=useState(()=>editFields(record)),[value,setValue]=useState((record.amount/100).toFixed(2).replace('.',',')),[error,setError]=useState('');
 function field<K extends keyof EditFields>(key:K,v:EditFields[K]){setDraft(d=>({...d,[key]:v}));setError('');}
 const preview=useMemo(()=>{try{return schedule(validateEdit({...draft,amount:money(value)}));}catch{return [];}},[draft,value]);
 async function submit(e:React.FormEvent){e.preventDefault();try{setError('');await onSave(validateEdit({...draft,amount:money(value)}));}catch(e){setError(e instanceof Error?e.message:'Confira os campos.');}}
 return <form onSubmit={submit} className="record-form">
  <p className="form-warning">A edição altera a compra inteira e recalcula todas as parcelas, inclusive em meses anteriores.</p>
  <fieldset disabled={busy}>
   <Field label="Nome" id="record-name"><Input id="record-name" value={draft.description} maxLength={200} required onChange={e=>field('description',e.target.value)}/></Field>
   <div className="form-grid">
    <Field label="Tipo" id="record-type"><SegmentedControl id="record-type" aria-labelledby="record-type-label" value={draft.type} disabled={busy} options={[{value:'despesa',label:'Despesa'},{value:'receita',label:'Receita'}]} onValueChange={value=>{const type=value as EditFields['type'];setDraft(d=>({...d,type,category:type==='receita'?'Receitas':'Outros'}));}}/></Field>
    <Field label="Categoria" id="record-category"><Select id="record-category" aria-labelledby="record-category-label" value={draft.category} disabled={busy} onValueChange={value=>field('category',value)} options={(draft.type==='receita'?['Receitas']:expenseCategories).map(c=>({value:c,label:c}))}/></Field>
    <Field label="Valor total (R$)" id="record-amount"><div className="zelumi-money"><span aria-hidden="true">R$</span><Input id="record-amount" inputMode="decimal" value={value} required onChange={e=>setValue(e.target.value)}/></div></Field>
    <Field label="Data da compra" id="record-date"><DateField id="record-date" aria-label="Data da compra" min="1900-01-01" max="9990-12-31" required disabled={busy} value={draft.date} onValueChange={value=>field('date',value)}/></Field>
    <Field label="Parcelas" id="record-parts"><NumberField id="record-parts" aria-label="Parcelas" min={1} max={120} value={draft.installments} required disabled={busy} onValueChange={value=>setDraft(d=>({...d,installments:value,installmentStartMonth:value>1?d.installmentStartMonth:null}))}/></Field>
    {draft.installments>1&&<Field label="Mês da primeira parcela" id="record-first-month"><MonthField id="record-first-month" aria-label="Mês da primeira parcela" min="1900-01" max="9990-12" disabled={busy} value={draft.installmentStartMonth||draft.date.slice(0,7)} onValueChange={value=>field('installmentStartMonth',value)}/></Field>}
   </div>
  </fieldset>
  <details className="schedule-preview"><summary>Prévia: {preview.length} parcela(s) · {brl(preview.reduce((s,r)=>s+r.amount,0))}</summary><ol>{preview.map((r,i)=><li key={r.date}><span>{i+1}/{preview.length} · {formatDate(r.date)}</span><strong>{brl(r.amount)}</strong></li>)}</ol></details>
  {error&&<p role="alert" className="error-message">{error}</p>}
  <div className="dialog-actions"><Button variant="outline" type="button" disabled={busy} onClick={onCancel}>Voltar</Button><Button type="submit" disabled={busy}>{busy?'Salvando…':'Salvar alterações'}</Button></div>
 </form>;
}
