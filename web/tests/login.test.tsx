import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {TelegramLogin} from '@/components/telegram-login';
it('envia o retorno ao servidor e só conclui depois da validação',async()=>{
 let finish!:(r:Response)=>void;const onSuccess=vi.fn();
 const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({botUsername:'test_bot',csrfToken:'csrf'}))).mockReturnValueOnce(new Promise<Response>(resolve=>{finish=resolve;}));vi.stubGlobal('fetch',fetch);
 const {container}=render(<TelegramLogin onSuccess={onSuccess}/>);fireEvent.click(screen.getByRole('button',{name:'Entrar com Telegram'}));
 await waitFor(()=>expect(container.querySelector('iframe')).not.toBeNull());
 const frame=container.querySelector('iframe')!;expect(frame.src).toContain('bot=test_bot');
 await act(async()=>{window.dispatchEvent(new MessageEvent('message',{origin:window.location.origin,source:frame.contentWindow,data:{type:'zelumi.telegram.auth',user:{id:11,hash:'signed'}}}));});expect(onSuccess).not.toHaveBeenCalled();
 expect(fetch.mock.calls[1][1].headers['X-CSRF-Token']).toBe('csrf');
 await act(async()=>{finish(new Response(JSON.stringify({ok:true})));});await waitFor(()=>expect(onSuccess).toHaveBeenCalledOnce());
});
it('widget bloqueado mostra erro e permite reiniciar sem autenticar',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({botUsername:'test_bot',csrfToken:'csrf'}))));const onSuccess=vi.fn();
 const {container}=render(<TelegramLogin onSuccess={onSuccess}/>);fireEvent.click(screen.getByRole('button',{name:'Entrar com Telegram'}));
 await waitFor(()=>expect(container.querySelector('iframe')).not.toBeNull());const frame=container.querySelector('iframe')!;
 fireEvent(window,new MessageEvent('message',{origin:window.location.origin,source:frame.contentWindow,data:{type:'zelumi.telegram.error'}}));
 await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Tentar novamente'})).toBeInTheDocument();expect(onSuccess).not.toHaveBeenCalled();
});
it('ignora identidade enviada por outra janela ou origem',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({botUsername:'test_bot',csrfToken:'csrf'})));vi.stubGlobal('fetch',fetch);
 const {container}=render(<TelegramLogin onSuccess={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'Entrar com Telegram'}));await waitFor(()=>expect(container.querySelector('iframe')).not.toBeNull());
 fireEvent(window,new MessageEvent('message',{origin:'https://evil.example',source:container.querySelector('iframe')!.contentWindow,data:{type:'zelumi.telegram.auth',user:{id:22}}}));
 fireEvent(window,new MessageEvent('message',{origin:window.location.origin,source:window,data:{type:'zelumi.telegram.auth',user:{id:22}}}));expect(fetch).toHaveBeenCalledOnce();
});
