import {beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,within,waitFor} from '@testing-library/react';
import {AppShell} from '@/components/app-shell';
let path='/visao-geral/';
vi.mock('next/navigation',()=>({usePathname:()=>path,useRouter:()=>({replace:vi.fn()})}));
vi.mock('@/components/session-provider',()=>({useSession:()=>({status:'authenticated',user:{firstName:'Teste'},csrfToken:'csrf'})}));
beforeEach(()=>{
 localStorage.clear();path='/visao-geral/';
 vi.stubGlobal('matchMedia',vi.fn().mockImplementation(()=>Object.assign(new EventTarget(),{matches:false,media:'(max-width: 760px)'})));
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.open=true;}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(){this.open=false;this.dispatchEvent(new Event('close'));}});
});
it('recolhe e expande mantendo navegação nomeada e conteúdo montado',()=>{
 render(<AppShell><input aria-label="Rascunho" defaultValue="Meu texto"/></AppShell>);
 const shell=screen.getByRole('complementary',{name:'Barra lateral'}).parentElement!;
 const input=screen.getByRole('textbox',{name:'Rascunho'});
 const toggle=screen.getByRole('button',{name:'Recolher barra lateral'});
 expect(toggle).toHaveAttribute('aria-expanded','true');fireEvent.click(toggle);
 expect(shell).toHaveAttribute('data-sidebar-collapsed','true');
 expect(screen.getByRole('button',{name:'Expandir barra lateral'})).toHaveAttribute('aria-expanded','false');
 const sidebar=screen.getByRole('complementary',{name:'Barra lateral'});
 expect(within(sidebar).getByRole('link',{name:'Visão geral'})).toHaveAttribute('aria-current','page');
 expect(within(sidebar).getByRole('link',{name:'Lançamentos'})).toHaveAttribute('href',expect.stringMatching(/^\/lancamentos\/?$/));
 expect(within(sidebar).getByRole('link',{name:'Abrir o Telegram'})).toHaveAttribute('href','https://t.me/zelumi_bot');
 expect(screen.getByRole('textbox',{name:'Rascunho'})).toBe(input);
 fireEvent.click(screen.getByRole('button',{name:'Expandir barra lateral'}));
 expect(shell).toHaveAttribute('data-sidebar-collapsed','false');
});
it('restaura a preferência depois de remontar o site',()=>{
 const view=render(<AppShell>Conteúdo</AppShell>);fireEvent.click(screen.getByRole('button',{name:'Recolher barra lateral'}));view.unmount();
 render(<AppShell>Conteúdo</AppShell>);expect(screen.getByRole('button',{name:'Expandir barra lateral'})).toBeInTheDocument();
});
it('continua funcionando quando o navegador bloqueia armazenamento',()=>{
 vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('Bloqueado');});
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Bloqueado');});
 render(<AppShell>Conteúdo</AppShell>);fireEvent.click(screen.getByRole('button',{name:'Recolher barra lateral'}));
 expect(screen.getByRole('button',{name:'Expandir barra lateral'})).toBeInTheDocument();
});
it('abre menu móvel e devolve foco ao botão ao fechar',async()=>{
 render(<AppShell>Conteúdo</AppShell>);const opener=screen.getByRole('button',{name:'Abrir menu'});fireEvent.click(opener);
 const dialog=screen.getByRole('dialog',{name:'Menu de navegação'});
 expect(opener).toHaveAttribute('aria-expanded','true');expect(document.body.style.overflow).toBe('hidden');
 expect(within(dialog).getByRole('button',{name:'Fechar menu'})).toHaveFocus();
 fireEvent.click(within(dialog).getByRole('button',{name:'Fechar menu'}));
 await waitFor(()=>expect(opener).toHaveFocus());expect(opener).toHaveAttribute('aria-expanded','false');expect(document.body.style.overflow).toBe('');
});
it('fecha menu ao navegar ou tocar fora, sem mudar preferência do desktop',()=>{
 const view=render(<AppShell>Conteúdo</AppShell>);fireEvent.click(screen.getByRole('button',{name:'Recolher barra lateral'}));
 fireEvent.click(screen.getByRole('button',{name:'Abrir menu'}));
 const destination=within(screen.getByRole('dialog')).getByRole('link',{name:'Lançamentos'});
 destination.addEventListener('click',event=>event.preventDefault());fireEvent.click(destination);
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Abrir menu'}));
 path='/perfil/';view.rerender(<AppShell>Conteúdo</AppShell>);expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Abrir menu'}));fireEvent.click(screen.getByRole('dialog'));
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Expandir barra lateral'})).toBeInTheDocument();
});

it('fecha o drawer quando a janela volta ao tamanho de desktop',()=>{
 render(<AppShell>Conteúdo</AppShell>);fireEvent.click(screen.getByRole('button',{name:'Abrir menu'}));
 const media=vi.mocked(window.matchMedia).mock.results[0].value;
 fireEvent(media,new Event('change'));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 expect(document.body.style.overflow).toBe('');
});
it('Escape dispensa as dicas sem tirar o foco da navegação',()=>{
 render(<AppShell>Conteúdo</AppShell>);fireEvent.click(screen.getByRole('button',{name:'Recolher barra lateral'}));
 const sidebar=screen.getByRole('complementary',{name:'Barra lateral'}),link=within(sidebar).getByRole('link',{name:'Visão geral'});
 fireEvent.focus(link);expect(within(sidebar).getByText('Visão geral',{selector:'.sidebar-tooltip'})).toBeInTheDocument();
 fireEvent.keyDown(link,{key:'Escape'});expect(within(sidebar).queryByText('Visão geral',{selector:'.sidebar-tooltip'})).not.toBeInTheDocument();
 fireEvent.mouseEnter(link);expect(within(sidebar).getByText('Visão geral',{selector:'.sidebar-tooltip'})).toBeInTheDocument();
});
it('layout compartilhado mantém a mesma barra recolhida entre páginas reais',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>new Promise<Response>(()=>{})));
 const [{default:DashboardLayout},{default:OverviewPage},{default:HistoryPage},{default:ProfilePage}]=await Promise.all([
  import('@/app/(dashboard)/layout'),import('@/app/(dashboard)/visao-geral/page'),import('@/app/(dashboard)/lancamentos/page'),import('@/app/(dashboard)/perfil/page')
 ]);
 const view=render(<DashboardLayout><OverviewPage/></DashboardLayout>);
 const sidebar=screen.getByRole('complementary',{name:'Barra lateral'});
 fireEvent.click(screen.getByRole('button',{name:'Recolher barra lateral'}));
 path='/lancamentos/';view.rerender(<DashboardLayout><HistoryPage/></DashboardLayout>);
 expect(screen.getAllByRole('complementary',{name:'Barra lateral'})).toEqual([sidebar]);
 expect(screen.getByRole('button',{name:'Expandir barra lateral'})).toBeInTheDocument();
 expect(within(sidebar).getByRole('link',{name:'Lançamentos'})).toHaveAttribute('aria-current','page');
 path='/perfil/';view.rerender(<DashboardLayout><ProfilePage/></DashboardLayout>);
 expect(screen.getByRole('complementary',{name:'Barra lateral'})).toBe(sidebar);
 expect(screen.getByRole('button',{name:'Expandir barra lateral'})).toBeInTheDocument();
 expect(within(sidebar).getByRole('link',{name:'Perfil'})).toHaveAttribute('aria-current','page');
});
