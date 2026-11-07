import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {TelegramLogin} from '@/features/auth/components/telegram-login';
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status});
const config={botId:'123',botUsername:'test_bot'},flow={botUsername:'test_bot',csrfToken:'a'.repeat(64)};
type BridgeWindow=Window&{zelumiTelegramOpenAuth?:(nonce:string)=>boolean};
function message(frame:HTMLIFrameElement,type:string,user?:unknown,origin=window.location.origin){fireEvent(window,new MessageEvent('message',{origin,source:frame.contentWindow,data:{type:`zelumi.telegram.${type}`,idToken:user}}));}
async function ready(container:HTMLElement){
 await waitFor(()=>expect(container.querySelector('iframe')).not.toBeNull());
 const frame=container.querySelector('iframe')!;(frame.contentWindow as BridgeWindow).zelumiTelegramOpenAuth=vi.fn(()=>true);message(frame,'ready');
 await waitFor(()=>expect(screen.getByRole('button',{name:'Entrar com Telegram'})).toBeEnabled());return frame;
}
function setup(callback=(path:string)=>Promise.resolve(response(path.endsWith('/config')?config:path.endsWith('/start')?flow:{ok:true}))){
 vi.spyOn(crypto,'getRandomValues').mockImplementation((array:any)=>{array.fill(170);return array;});
 const fetch=vi.fn().mockImplementation(callback);vi.stubGlobal('fetch',fetch);const onSuccess=vi.fn(),view=render(<TelegramLogin onSuccess={onSuccess}/>);return {...view,fetch,onSuccess};
}
it('mantém botão próprio, prepara SDK sem criar fluxo e abre autorização no clique',async()=>{
 const {container,fetch}=setup();const frame=await ready(container);
 expect(frame).toHaveAttribute('hidden');expect(frame).toHaveAttribute('aria-hidden','true');
 expect(fetch).toHaveBeenCalledOnce();expect(fetch.mock.calls[0][0]).toBe('/auth/telegram/config');
 fireEvent.click(screen.getByRole('button',{name:'Entrar com Telegram'}));
 expect((frame.contentWindow as BridgeWindow).zelumiTelegramOpenAuth).toHaveBeenCalledWith('a'.repeat(64));
 expect(screen.getByRole('button',{name:'Aguardando Telegram…'})).toHaveClass('login-button');
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));expect(screen.queryByText(/botão oficial/)).not.toBeInTheDocument();
});
it('só conclui depois da verificação do servidor e ignora retorno duplicado',async()=>{
 let finish!:(r:Response)=>void;
 const {container,fetch,onSuccess}=setup(path=>path.endsWith('/callback')?new Promise<Response>(r=>{finish=r;}):Promise.resolve(response(path.endsWith('/config')?config:flow)));
 const frame=await ready(container);fireEvent.click(screen.getByRole('button',{name:'Entrar com Telegram'}));await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));
 message(frame,'auth','signed.jwt');message(frame,'auth','signed.jwt');await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(3));
 expect(fetch.mock.calls[2][1].headers['X-CSRF-Token']).toBe('a'.repeat(64));expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({idToken:'signed.jwt'});expect(onSuccess).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Confirmando acesso…'})).toBeDisabled();
 await act(async()=>{finish(response({ok:true}));});await waitFor(()=>expect(onSuccess).toHaveBeenCalledOnce());
});
it('espera o fluxo quando o Telegram responde antes da preparação do servidor',async()=>{
 let start!:(r:Response)=>void;
 const {container,fetch}=setup(path=>path.endsWith('/start')?new Promise<Response>(r=>{start=r;}):Promise.resolve(response(path.endsWith('/config')?config:{ok:true})));
 const frame=await ready(container);fireEvent.click(screen.getByRole('button',{name:'Entrar com Telegram'}));message(frame,'auth','signed.jwt');expect(fetch).toHaveBeenCalledTimes(2);
 await act(async()=>{start(response(flow));});await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(3));
});
it('ignora mensagens sem clique, de outra janela ou de outra origem',async()=>{
 const {container,fetch}=setup();const frame=await ready(container);message(frame,'auth',{id:22});expect(fetch).toHaveBeenCalledOnce();
 fireEvent.click(screen.getByRole('button',{name:'Entrar com Telegram'}));message(frame,'auth',{id:22},'https://evil.example');
 fireEvent(window,new MessageEvent('message',{origin:window.location.origin,source:window,data:{type:'zelumi.telegram.auth',user:{id:22}}}));expect(fetch).toHaveBeenCalledTimes(2);
});
it('cancelamento mantém botão próprio e reutiliza fluxo válido sem consumir nova tentativa',async()=>{
 const {container,fetch,onSuccess}=setup();const frame=await ready(container);fireEvent.click(screen.getByRole('button',{name:'Entrar com Telegram'}));await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));
 message(frame,'cancel');
 const next=await ready(container);expect(next).not.toBe(frame);
 fireEvent.click(screen.getByRole('button',{name:'Entrar com Telegram'}));expect(fetch).toHaveBeenCalledTimes(2);expect(onSuccess).not.toHaveBeenCalled();
});
it('popup bloqueado permite repetir sem criar um fluxo de login',async()=>{
 const {container,fetch}=setup();const frame=await ready(container);(frame.contentWindow as BridgeWindow).zelumiTelegramOpenAuth=()=>false;
 fireEvent.click(screen.getByRole('button',{name:'Entrar com Telegram'}));expect(await screen.findByRole('alert')).toHaveTextContent(/Permita.*janela/i);expect(fetch).toHaveBeenCalledOnce();expect(screen.getByRole('button',{name:'Entrar com Telegram'})).toBeEnabled();
});
it('erro do SDK permite recarregar e não aceita callback de uma conexão anterior',async()=>{
 const {container,fetch,onSuccess}=setup();const old=await ready(container);message(old,'error');expect(await screen.findByRole('alert')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));const next=await ready(container);expect(next).not.toBe(old);message(old,'auth',{id:22});expect(onSuccess).not.toHaveBeenCalled();expect(fetch).toHaveBeenCalledTimes(2);
});
it('expiração ignora autorização tardia e pede nova tentativa',async()=>{
 const {container,onSuccess}=setup();const frame=await ready(container);
 vi.useFakeTimers();
 try{
  fireEvent.click(screen.getByRole('button',{name:'Entrar com Telegram'}));
  await act(async()=>{await vi.advanceTimersByTimeAsync(600001);});
  expect(screen.getByRole('alert')).toHaveTextContent('O acesso expirou');
  message(frame,'auth',{id:22});expect(onSuccess).not.toHaveBeenCalled();
 }finally{vi.useRealTimers();}
});
it('trocar callback do componente não reinicia o prazo de carregamento do SDK pronto',async()=>{
 const {container,rerender}=setup();await ready(container);vi.useFakeTimers();
 try{
  rerender(<TelegramLogin onSuccess={vi.fn()}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(25001);});
  expect(screen.getByRole('button',{name:'Entrar com Telegram'})).toBeEnabled();
 }finally{vi.useRealTimers();}
});
