import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {it,expect,vi} from 'vitest';
const code=readFileSync('public/telegram-widget.js','utf8');
function fixture(blocked=false){
 const report=vi.fn(),popup={closed:false,close:vi.fn()},open=vi.fn(()=>blocked?null:popup);
 let callback!:(user:unknown)=>void;
 const win:any={parent:{postMessage:report},open,addEventListener:vi.fn(),Telegram:{Login:{auth:vi.fn((options,cb)=>{callback=cb;win.open('https://oauth.telegram.org/auth?bot_id='+options.bot_id);})}}};
 const scripts:any[]=[];
 const document={createElement:()=>({}),head:{append:(script:unknown)=>scripts.push(script)},body:{append:(script:unknown)=>scripts.push(script)}};
 runInNewContext(code,{window:win,parent:win.parent,document,location:{origin:'https://zelumi.example',search:'?botId=123'},URLSearchParams,setTimeout:vi.fn(()=>1),clearTimeout:vi.fn()});
 return {win,report,popup,open,scripts,auth:(user:unknown)=>callback(user)};
}
it('carrega SDK sem criar botão e abre autorização só pela ponte síncrona',()=>{
 const {win,report,scripts,open,auth}=fixture();
 expect(scripts).toHaveLength(1);expect(scripts[0].src).toBe('https://telegram.org/js/telegram-widget.js?22');
 expect(open).not.toHaveBeenCalled();scripts[0].onload();
 expect(report).toHaveBeenCalledWith({type:'zelumi.telegram.ready'},'https://zelumi.example');
 expect(win.zelumiTelegramOpenAuth()).toBe(true);expect(win.Telegram.Login.auth).toHaveBeenCalledWith({bot_id:'123',lang:'pt'},expect.any(Function));
 expect(win.open).toBe(open);auth({id:11,hash:'signed'});
 expect(report).toHaveBeenCalledWith({type:'zelumi.telegram.auth',user:{id:11,hash:'signed'}},'https://zelumi.example');
});
it('detecta popup bloqueado e restaura window.open sem enviar autenticação',()=>{
 const {win,report,scripts,open}=fixture(true);scripts[0].onload();
 expect(win.zelumiTelegramOpenAuth()).toBe(false);expect(win.open).toBe(open);
 expect(report.mock.calls.some(([data])=>data.type==='zelumi.telegram.auth')).toBe(false);
});
it('cancelamento permite nova tentativa e rejeita retorno duplicado',()=>{
 const {win,report,scripts,auth}=fixture();scripts[0].onload();win.zelumiTelegramOpenAuth();auth(false);auth({id:11});
 expect(report).toHaveBeenCalledWith({type:'zelumi.telegram.cancel'},'https://zelumi.example');
 expect(report.mock.calls.some(([data])=>data.type==='zelumi.telegram.auth')).toBe(false);
 expect(win.zelumiTelegramOpenAuth()).toBe(true);
});
it('callback antigo não interfere na tentativa seguinte',()=>{
 const {win,report,scripts,auth}=fixture();scripts[0].onload();win.zelumiTelegramOpenAuth();
 const oldCallback=win.Telegram.Login.auth.mock.calls[0][1];auth(false);win.zelumiTelegramOpenAuth();oldCallback({id:22,hash:'old'});
 expect(report.mock.calls.some(([data])=>data.type==='zelumi.telegram.auth')).toBe(false);
 auth({id:11,hash:'new'});expect(report).toHaveBeenCalledWith({type:'zelumi.telegram.auth',user:{id:11,hash:'new'}},'https://zelumi.example');
});
