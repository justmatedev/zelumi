'use client';
import {useState} from 'react';
import {api} from '@/lib/api';
import {Button} from '@/components/ui/button';
export function LocalLogin({onSuccess}:{onSuccess:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function login(){
  setBusy(true);setError('');
  try{await api('/auth/local',{body:{}});onSuccess();}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível acessar a conta de teste.');}
  finally{setBusy(false);}
 }
 return <div><p className="login-help">Ambiente local · dados fictícios</p><Button onClick={()=>void login()} disabled={busy}>{busy?'Entrando…':'Entrar com conta de teste'}</Button>{error&&<p role="alert" className="error-message">{error}</p>}</div>;
}
