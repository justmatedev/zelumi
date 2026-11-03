// The official legacy SDK stays isolated from the application. It renders no UI.
(() => {
 const report=(type,user)=>parent.postMessage({type:'zelumi.telegram.'+type,...(user===undefined?{}:{user})},location.origin);
 const botId=new URLSearchParams(location.search).get('botId');
 if(!/^[1-9]\d{0,15}$/.test(botId||'')){report('error');return;}
 let ready=false,inFlight=false,popup=null,sequence=0;
 const timer=setTimeout(()=>{if(!ready)report('error');},20000);
 window.zelumiTelegramOpenAuth=()=>{
  if(!ready||inFlight)return false;
  inFlight=true;
  const current=++sequence;
  const originalOpen=window.open;
  let opened=null;
  // The legacy SDK does not return its popup. Capture only its synchronous open
  // call in this isolated window so a blocked popup can be reported immediately.
  window.open=function(...args){opened=originalOpen.apply(window,args);return opened;};
  try{
   window.Telegram.Login.auth({bot_id:botId,lang:'pt'},user=>{
    if(!inFlight||current!==sequence)return;
    inFlight=false;
    if(popup&&!popup.closed)popup.close();
    popup=null;
    if(user)report('auth',user);else report('cancel');
   });
  }catch{inFlight=false;report('error');return false;}
  finally{window.open=originalOpen;}
  popup=opened;
  if(!popup){inFlight=false;return false;}
  return true;
 };
 window.addEventListener('pagehide',()=>{clearTimeout(timer);inFlight=false;if(popup&&!popup.closed)popup.close();});
 const script=document.createElement('script');script.src='https://telegram.org/js/telegram-widget.js?22';script.async=true;
 script.onload=()=>{clearTimeout(timer);ready=typeof window.Telegram?.Login?.auth==='function';report(ready?'ready':'error');};
 script.onerror=()=>{clearTimeout(timer);report('error');};
 document.head.append(script);
})();
