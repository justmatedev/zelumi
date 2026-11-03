import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {LocalLogin} from '@/features/auth/components/local-login';
it('login de teste aguarda a sessão antes de abrir o painel',async()=>{
 let finish!:(r:Response)=>void;
 vi.stubGlobal('fetch',vi.fn().mockReturnValue(new Promise<Response>(r=>{finish=r;})));
 const success=vi.fn();render(<LocalLogin onSuccess={success}/>);
 fireEvent.click(screen.getByRole('button',{name:'Entrar com conta de teste'}));
 expect(screen.getByRole('button',{name:'Entrando…'})).toBeDisabled();expect(success).not.toHaveBeenCalled();
 await act(async()=>{finish(new Response(JSON.stringify({ok:true})));});await waitFor(()=>expect(success).toHaveBeenCalledOnce());
});
it('falha no login local informa o erro e permite nova tentativa',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:'Servidor local indisponível.'}),{status:503})).mockResolvedValueOnce(new Response(JSON.stringify({ok:true}))));
 const success=vi.fn();render(<LocalLogin onSuccess={success}/>);
 fireEvent.click(screen.getByRole('button',{name:'Entrar com conta de teste'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Servidor local indisponível.');expect(success).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Entrar com conta de teste'}));await waitFor(()=>expect(success).toHaveBeenCalledOnce());
});
