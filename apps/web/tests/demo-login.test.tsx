import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {DemoLogin} from '@/features/auth/components/demo-login';
import {LoginPage} from '@/features/auth/components/login-page';
import {Profile} from '@/features/profile/components/profile';
const replace=vi.fn();
vi.mock('next/navigation',()=>({useRouter:()=>({replace})}));
vi.mock('@/features/auth/providers/session-provider',()=>({useSession:()=>({status:'anonymous',refresh:vi.fn().mockResolvedValue(undefined),user:{firstName:'Visitante',lastName:null,username:null},logout:vi.fn(),csrfToken:'csrf'})}));
vi.mock('@/components/theme-provider',()=>({useTheme:()=>({theme:'light',setTheme:vi.fn()})}));
vi.mock('@/features/profile/components/category-management',()=>({CategoryManagement:()=>null}));
afterEach(()=>vi.unstubAllEnvs());
it('aguarda criação da demonstração antes de abrir o painel e impede cliques duplicados',async()=>{
 let finish!:(r:Response)=>void;const fetch=vi.fn().mockReturnValue(new Promise<Response>(r=>{finish=r;}));vi.stubGlobal('fetch',fetch);
 const success=vi.fn();render(<DemoLogin onSuccess={success}/>);
 fireEvent.click(screen.getByRole('button',{name:'Explorar demonstração'}));
 expect(screen.getByRole('button',{name:'Preparando demonstração…'})).toBeDisabled();expect(success).not.toHaveBeenCalled();
 expect(fetch).toHaveBeenCalledWith('/auth/demo',expect.objectContaining({method:'POST',body:'{}',credentials:'same-origin'}));
 await act(async()=>finish(new Response(JSON.stringify({ok:true}))));await waitFor(()=>expect(success).toHaveBeenCalledOnce());
});
it('informa falha e permite tentar novamente',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:'Aguarde alguns minutos.'}),{status:429})).mockResolvedValueOnce(new Response(JSON.stringify({ok:true}))));
 const success=vi.fn();render(<DemoLogin onSuccess={success}/>);
 fireEvent.click(screen.getByRole('button',{name:'Explorar demonstração'}));expect(await screen.findByRole('alert')).toHaveTextContent('Aguarde alguns minutos.');
 expect(success).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Explorar demonstração'}));await waitFor(()=>expect(success).toHaveBeenCalledOnce());
});
it('build demo apresenta acesso fictício sem solicitar conta Telegram',()=>{
 vi.stubEnv('NEXT_PUBLIC_DEMO','1');render(<LoginPage/>);
 expect(screen.getByRole('button',{name:'Explorar demonstração'})).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Entrar com Telegram'})).not.toBeInTheDocument();
 expect(screen.getByText(/Não informe dados pessoais/)).toBeInTheDocument();
});
it('perfil demo identifica a conta fictícia sem afirmar vínculo com Telegram',()=>{
 vi.stubEnv('NEXT_PUBLIC_DEMO','1');render(<Profile/>);
 expect(screen.getByRole('heading',{name:'Conta de demonstração'})).toBeInTheDocument();
 expect(screen.queryByText('Telegram vinculado')).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Sair da conta'})).toBeInTheDocument();
});
