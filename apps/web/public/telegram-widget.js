// The official OIDC SDK stays isolated from the application. It renders no UI.
(() => {
 const report=(type,idToken)=>parent.postMessage({type:'zelumi.telegram.'+type,...(idToken===undefined?{}:{idToken})},location.origin);
 const botId=new URLSearchParams(location.search).get('botId');
 if(!/^[1-9]\d{0,15}$/.test(botId||'')){report('error');return;}
 let ready=false,inFlight=false,popup=null,sequence=0;
 const timer=setTimeout(()=>{if(!ready)report('error');},20000);
 window.zelumiTelegramOpenAuth=nonce=>{
  if(!ready||inFlight||!/^[a-f0-9]{64}$/.test(nonce||''))return false;
  inFlight=true;
  const current=++sequence;
  const originalOpen=window.open;
  let opened=null;
  // The SDK does not return its popup. Capture only its synchronous open
  // call in this isolated window so a blocked popup can be reported immediately.
  window.open=function(...args){opened=originalOpen.apply(window,args);return opened;};
  try{
   window.Telegram.Login.auth({client_id:Number(botId),scope:['profile'],nonce,lang:'pt'},result=>{
    if(!inFlight||current!==sequence)return;
    inFlight=false;
    if(popup&&!popup.closed)popup.close();
    popup=null;
    if(result?.error==='popup_closed')report('cancel');
    else if(!result?.error&&typeof result?.id_token==='string'&&result.id_token)report('auth',result.id_token);
    else report('error');
   });
  }catch{inFlight=false;report('error');return false;}
  finally{window.open=originalOpen;}
  popup=opened;
  if(!popup){inFlight=false;return false;}
  return true;
 };
 window.addEventListener('pagehide',()=>{clearTimeout(timer);inFlight=false;if(popup&&!popup.closed)popup.close();});
 const script=document.createElement('script');script.src='https://oauth.telegram.org/js/telegram-login.js?6';script.async=true;
 script.onload=()=>{clearTimeout(timer);ready=typeof window.Telegram?.Login?.auth==='function';report(ready?'ready':'error');};
 script.onerror=()=>{clearTimeout(timer);report('error');};
 document.head.append(script);
})();
