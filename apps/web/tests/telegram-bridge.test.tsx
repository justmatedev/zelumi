import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {it,expect,vi} from 'vitest';
const code=readFileSync('public/telegram-widget.js','utf8');
function fixture(blocked=false){
 const report=vi.fn(),popup={closed:false,close:vi.fn()},open=vi.fn(()=>blocked?null:popup);
 let callback!:(user:unknown)=>void;
 const win:any={parent:{postMessage:report},open,addEventListener:vi.fn(),Telegram:{Login:{auth:vi.fn((options,cb)=>{callback=cb;win.open('https://oauth.telegram.org/auth?client_id='+options.client_id);})}}};
 const scripts:any[]=[];
 const document={createElement:()=>({}),head:{append:(script:unknown)=>scripts.push(script)},body:{append:(script:unknown)=>scripts.push(script)}};
 runInNewContext(code,{window:win,parent:win.parent,document,location:{origin:'https://zelumi.example',search:'?botId=123'},URLSearchParams,setTimeout:vi.fn(()=>1),clearTimeout:vi.fn()});
 return {win,report,popup,open,scripts,auth:(user:unknown)=>callback(user)};
}
it('carrega SDK sem criar botão e abre autorização só pela ponte síncrona',()=>{
 const {win,report,scripts,open,auth}=fixture();
 expect(scripts).toHaveLength(1);expect(scripts[0].src).toBe('https://oauth.telegram.org/js/telegram-login.js?6');
 expect(open).not.toHaveBeenCalled();scripts[0].onload();
 expect(report).toHaveBeenCalledWith({type:'zelumi.telegram.ready'},'https://zelumi.example');
 expect(win.zelumiTelegramOpenAuth('a'.repeat(64))).toBe(true);expect(win.Telegram.Login.auth).toHaveBeenCalledWith({client_id:123,scope:['profile'],nonce:'a'.repeat(64),lang:'pt'},expect.any(Function));
 expect(win.open).toBe(open);auth({id_token:'signed.jwt',user:{id:22}});
 expect(report).toHaveBeenCalledWith({type:'zelumi.telegram.auth',idToken:'signed.jwt'},'https://zelumi.example');
});
it('detecta popup bloqueado e restaura window.open sem enviar autenticação',()=>{
 const {win,report,scripts,open}=fixture(true);scripts[0].onload();
 expect(win.zelumiTelegramOpenAuth('a'.repeat(64))).toBe(false);expect(win.open).toBe(open);
 expect(report.mock.calls.some(([data])=>data.type==='zelumi.telegram.auth')).toBe(false);
});
it('cancelamento permite nova tentativa e rejeita retorno duplicado',()=>{
 const {win,report,scripts,auth}=fixture();scripts[0].onload();win.zelumiTelegramOpenAuth('a'.repeat(64));auth({error:'popup_closed'});auth({id:11});
 expect(report).toHaveBeenCalledWith({type:'zelumi.telegram.cancel'},'https://zelumi.example');
 expect(report.mock.calls.some(([data])=>data.type==='zelumi.telegram.auth')).toBe(false);
 expect(win.zelumiTelegramOpenAuth('a'.repeat(64))).toBe(true);
});
it('callback antigo não interfere na tentativa seguinte',()=>{
 const {win,report,scripts,auth}=fixture();scripts[0].onload();win.zelumiTelegramOpenAuth('a'.repeat(64));
 const oldCallback=win.Telegram.Login.auth.mock.calls[0][1];auth({error:'popup_closed'});win.zelumiTelegramOpenAuth('a'.repeat(64));oldCallback({id:22,hash:'old'});
 expect(report.mock.calls.some(([data])=>data.type==='zelumi.telegram.auth')).toBe(false);
 auth({id_token:'new.jwt'});expect(report).toHaveBeenCalledWith({type:'zelumi.telegram.auth',idToken:'new.jwt'},'https://zelumi.example');
});

it('erro do provedor não é tratado como autorização nem expõe detalhes',()=>{
 const {win,report,scripts,auth}=fixture();scripts[0].onload();win.zelumiTelegramOpenAuth('a'.repeat(64));auth({error:'sensitive provider detail',id_token:'bad'});
 expect(report).toHaveBeenCalledWith({type:'zelumi.telegram.error'},'https://zelumi.example');
 expect(report.mock.calls.some(([data])=>data.type==='zelumi.telegram.auth')).toBe(false);
});
