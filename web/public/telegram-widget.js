// Only this isolated document loads the legacy widget, whose callback parser uses eval.
// The parent never receives credentials other than the signed public Telegram payload.
(() => {
 const report=(type,user)=>parent.postMessage({type,user},location.origin);
 const bot=new URLSearchParams(location.search).get('bot');
 if(!/^\w{5,32}$/.test(bot||'')){report('zelumi.telegram.error');return;}
 let ready=false;
 const timer=setTimeout(()=>{if(!ready)report('zelumi.telegram.error');},20000);
 window.zelumiTelegramAuth=user=>{clearTimeout(timer);report('zelumi.telegram.auth',user);};
 window.addEventListener('message',event=>{
  const frame=document.querySelector('iframe');
  if(event.origin!=='https://oauth.telegram.org'||event.source!==frame?.contentWindow)return;
  try{if(JSON.parse(event.data).event==='ready'){ready=true;clearTimeout(timer);}}catch{}
 });
 const script=document.createElement('script');script.src='https://telegram.org/js/telegram-widget.js?22';script.async=true;
 script.setAttribute('data-telegram-login',bot);script.setAttribute('data-size','large');script.setAttribute('data-userpic','false');script.setAttribute('data-radius','9');script.setAttribute('data-lang','pt');
 script.setAttribute('data-onauth','zelumiTelegramAuth(user)');script.onerror=()=>{clearTimeout(timer);report('zelumi.telegram.error');};document.body.append(script);
})();
