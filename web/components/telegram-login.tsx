'use client';
import {useEffect,useRef,useState} from 'react';
import {Send,RefreshCw} from 'lucide-react';
import {api} from '@/lib/api';
import {Button} from '@/components/ui/button';
export function TelegramLogin({onSuccess}:{onSuccess:()=>void}) {
 const [flow,setFlow]=useState<{botUsername:string;csrfToken:string}|null>(null);
 const [status,setStatus]=useState<'idle'|'starting'|'widget'|'checking'|'error'>('idle');
 const [error,setError]=useState('');const frame=useRef<HTMLIFrameElement>(null),generation=useRef(0),busy=useRef(false);
 async function start(){const id=++generation.current;busy.current=false;setError('');setFlow(null);setStatus('starting');
  try{const data=await api<{botUsername:string;csrfToken:string}>('/auth/telegram/start',{body:{}});if(generation.current===id){setFlow(data);setStatus('widget');}}
  catch(e){if(generation.current===id){setError(e instanceof Error?e.message:'Não foi possível iniciar o login.');setStatus('error');}}
 }
 useEffect(()=>{
  if(!flow)return;const id=generation.current;
  const fail=()=>{if(generation.current===id){setError('Não foi possível concluir o acesso pelo Telegram. Tente novamente.');setStatus('error');}};
  const timeout=setTimeout(fail,600000);
  async function receive(event:MessageEvent){
   if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow||!event.data||generation.current!==id)return;
   if(event.data.type==='zelumi.telegram.error'){fail();return;}
   if(event.data.type!=='zelumi.telegram.auth'||busy.current)return;
   busy.current=true;setStatus('checking');
   try{await api('/auth/telegram/callback',{body:{telegram:event.data.user},csrf:flow!.csrfToken});if(generation.current===id)onSuccess();}
   catch(e){if(generation.current===id){setError(e instanceof Error?e.message:'Não foi possível confirmar o acesso.');setStatus('error');}}
  }
  window.addEventListener('message',receive);return()=>{clearTimeout(timeout);window.removeEventListener('message',receive);};
 },[flow,onSuccess]);
 useEffect(()=>()=>{++generation.current;},[]);
 return <div className="telegram-login">
  {(status==='idle'||status==='error')&&<Button className="login-button" onClick={()=>void start()}>{status==='error'?<RefreshCw size={18}/>:<Send size={18}/>} {status==='error'?'Tentar novamente':'Entrar com Telegram'}</Button>}
  {status==='starting'&&<p role="status" className="login-progress">Preparando seu acesso…</p>}
  {(status==='widget'||status==='checking')&&flow&&<><iframe ref={frame} className="telegram-widget" title="Entrar com Telegram" src={`/telegram-widget.html?bot=${encodeURIComponent(flow.botUsername)}`} sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"/><p role="status" className="login-progress">{status==='checking'?'Confirmando seu acesso…':'Continue pelo botão oficial do Telegram acima.'}</p><Button variant="ghost" onClick={()=>void start()} disabled={status==='checking'}>Reiniciar acesso</Button></>}
  {error&&<p className="error-message" role="alert">{error}</p>}
 </div>;
}
