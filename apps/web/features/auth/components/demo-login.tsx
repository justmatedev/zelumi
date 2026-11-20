'use client';
import {useState} from 'react';
import {api} from '@/lib/api';
import {Button} from '@/components/ui/button';
export function DemoLogin({onSuccess}:{onSuccess:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function login(){
  setBusy(true);setError('');
  try{await api('/auth/demo',{body:{}});onSuccess();}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível iniciar a demonstração.');}
  finally{setBusy(false);}
 }
 return <div><Button className="login-button" onClick={()=>void login()} disabled={busy}>{busy?'Preparando demonstração…':'Explorar demonstração'}</Button><p className="login-help">Dados fictícios só para você explorar.<br/>Não informe dados pessoais. O acesso expira em 24 horas.</p>{error&&<p role="alert" className="error-message">{error}</p>}</div>;
}
