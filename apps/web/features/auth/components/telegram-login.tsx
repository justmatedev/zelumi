'use client';
import {useEffect,useLayoutEffect,useId,useRef,useState} from 'react';
import {Send,RefreshCw} from 'lucide-react';
import {api} from '@/lib/api';
import {Button} from '@/components/ui/button';

type Config={botId:string;botUsername:string};
type Flow={csrfToken:string;expiresAt:number};
type Attempt={csrf?:string;idToken?:string;confirming:boolean};
type BridgeWindow=Window&{zelumiTelegramOpenAuth?:(nonce:string)=>boolean};
type Status='loading'|'ready'|'waiting'|'checking'|'error';
export function TelegramLogin({onSuccess}:{onSuccess:()=>void}) {
 const [config,setConfig]=useState<Config|null>(null),[status,setStatus]=useState<Status>('loading'),[error,setError]=useState(''),[cancelled,setCancelled]=useState(false);
 const [bridgeVersion,setBridgeVersion]=useState(0),sdkReady=useRef(false);
 const frame=useRef<HTMLIFrameElement>(null),alive=useRef(false),generation=useRef(0),attempt=useRef<Attempt|null>(null);
 const pendingNonce=useRef<string|null>(null);
 const cachedFlow=useRef<Flow|null>(null),pendingFlow=useRef<Promise<Flow>|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const hint=useId();
 function clearTimer(){if(timer.current){clearTimeout(timer.current);timer.current=null;}}
 function fail(message='Não foi possível conectar ao Telegram. Tente novamente.'){
  if(!alive.current)return;clearTimer();attempt.current=null;setError(message);setStatus('error');
 }
 async function configure(){
  const id=++generation.current;clearTimer();attempt.current=null;sdkReady.current=false;setConfig(null);setError('');setCancelled(false);setStatus('loading');
  try{const data=await api<Config>('/auth/telegram/config');if(alive.current&&generation.current===id){
   if(!/^[1-9]\d{0,15}$/.test(data.botId))throw new Error('Configuração do Telegram indisponível.');
   setConfig(data);
  }}catch(e){if(alive.current&&generation.current===id)fail(e instanceof Error?e.message:undefined);}
 }
 // Public configuration and SDK loading do not create a server-side login attempt.
 useEffect(()=>{alive.current=true;void configure();return()=>{alive.current=false;++generation.current;clearTimer();attempt.current=null;};},[]);
 function getFlow(nonce:string){
  if(cachedFlow.current&&cachedFlow.current.expiresAt>Date.now())return Promise.resolve(cachedFlow.current);
  if(!pendingFlow.current){
   const expiresAt=Date.now()+600000;pendingNonce.current=nonce;
   pendingFlow.current=api<{csrfToken:string}>('/auth/telegram/start',{body:{nonce}}).then(data=>{
    if(data.csrfToken!==nonce)throw new Error('Não foi possível preparar o acesso. Atualize a página e tente novamente.');
    const flow={csrfToken:data.csrfToken,expiresAt};cachedFlow.current=flow;return flow;
   }).finally(()=>{pendingFlow.current=null;pendingNonce.current=null;});
  }
  return pendingFlow.current;
 }
 async function confirm(current:Attempt){
  if(!alive.current||attempt.current!==current||!current.csrf||!current.idToken||current.confirming)return;
  current.confirming=true;clearTimer();setStatus('checking');
  try{await api('/auth/telegram/callback',{body:{idToken:current.idToken},csrf:current.csrf});
   if(alive.current&&attempt.current===current){attempt.current=null;cachedFlow.current=null;onSuccess();}
  }catch(e){if(alive.current&&attempt.current===current){cachedFlow.current=null;fail(e instanceof Error?e.message:'Não foi possível confirmar seu acesso.');}}
 }
 useLayoutEffect(()=>{
  if(!config)return;
  const readyTimeout=sdkReady.current?undefined:setTimeout(()=>fail(),25000);
  function receive(event:MessageEvent){
   if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow||!event.data)return;
   const type=event.data.type;
   if(type==='zelumi.telegram.ready'){clearTimeout(readyTimeout);sdkReady.current=true;setStatus(s=>s==='loading'?'ready':s);return;}
   if(type==='zelumi.telegram.error'){clearTimeout(readyTimeout);fail();return;}
   const current=attempt.current;if(!current||current.confirming)return;
   if(type==='zelumi.telegram.cancel'){
    clearTimer();attempt.current=null;setCancelled(true);sdkReady.current=false;setStatus('loading');
    // A fresh SDK window also discards popup polling from the old attempt.
    setBridgeVersion(version=>version+1);return;
   }
   if(type==='zelumi.telegram.auth'&&typeof event.data.idToken==='string'&&event.data.idToken&&!current.idToken){current.idToken=event.data.idToken;void confirm(current);}
  }
  window.addEventListener('message',receive);
  return()=>{clearTimeout(readyTimeout);window.removeEventListener('message',receive);};
 },[config,bridgeVersion,onSuccess]);
 function begin(){
  if(status==='error'){void configure();return;}
  if(status!=='ready')return;
  const nonce=pendingNonce.current??(cachedFlow.current&&cachedFlow.current.expiresAt>Date.now()?cachedFlow.current.csrfToken:
   Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join(''));
  const current:Attempt={confirming:false};attempt.current=current;setError('');setCancelled(false);setStatus('waiting');
  // Calling the same-origin bridge synchronously keeps the browser's user gesture.
  try{if(!(frame.current?.contentWindow as BridgeWindow|null)?.zelumiTelegramOpenAuth?.(nonce)){
   attempt.current=null;setStatus('ready');setError('Permita a abertura da janela do Telegram no navegador e tente novamente.');return;
  }}catch{fail();return;}
  timer.current=setTimeout(()=>fail('O acesso expirou. Tente novamente.'),600000);
  void getFlow(nonce).then(flow=>{
   if(!alive.current||attempt.current!==current)return;
   current.csrf=flow.csrfToken;clearTimer();timer.current=setTimeout(()=>fail('O acesso expirou. Tente novamente.'),Math.max(0,flow.expiresAt-Date.now()));void confirm(current);
  }).catch(e=>{if(alive.current&&attempt.current===current)fail(e instanceof Error?e.message:undefined);});
 }
 const label=status==='loading'?'Preparando acesso…':status==='waiting'?'Aguardando Telegram…':status==='checking'?'Confirmando acesso…':status==='error'?'Tentar novamente':'Entrar com Telegram';
 return <div className="telegram-login">
  <Button className="login-button" onClick={begin} disabled={status==='loading'||status==='waiting'||status==='checking'} aria-describedby={hint} aria-busy={status==='loading'||status==='waiting'||status==='checking'}>
   {status==='error'?<RefreshCw size={18} aria-hidden="true"/>:<Send size={18} aria-hidden="true"/>} {label}
  </Button>
  <p id={hint} role="status" className="login-progress">{status==='checking'?'Estamos confirmando seu acesso.':status==='waiting'?'Confirme o acesso na janela do Telegram.':cancelled?'Acesso cancelado. Você pode tentar novamente.':'Uma janela do Telegram será aberta para confirmar seu acesso.'}</p>
  {config&&<iframe key={`${config.botId}:${generation.current}:${bridgeVersion}`} ref={frame} title="Conexão de autenticação com Telegram" hidden aria-hidden="true" tabIndex={-1} src={`/telegram-widget.html?botId=${encodeURIComponent(config.botId)}`} sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"/>}
  {error&&<p className="error-message" role="alert">{error}</p>}
 </div>;
}
