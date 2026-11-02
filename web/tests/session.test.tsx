import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {SessionProvider,useSession} from '@/components/session-provider';
const response=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status});
function Probe(){const s=useSession();return <><span>{s.status}</span><span>{s.user?.firstName}</span><button onClick={()=>void s.refresh()}>Atualizar</button><button onClick={()=>void s.logout().catch(()=>{})}>Sair</button></>;}
describe('sessão',()=>{
 it('distingue 401 de indisponibilidade temporária e permite tentar novamente',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(response(503,{})).mockResolvedValueOnce(response(401,{}));vi.stubGlobal('fetch',fetch);
  render(<SessionProvider><Probe/></SessionProvider>);await screen.findByText('error');fireEvent.click(screen.getByText('Atualizar'));await screen.findByText('anonymous');
 });
 it('logout revoga a sessão e remove o perfil',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(response(200,{user:{firstName:'João <>&',lastName:null,username:null},csrfToken:'csrf'})).mockResolvedValueOnce(response(200,{ok:true}));vi.stubGlobal('fetch',fetch);
  render(<SessionProvider><Probe/></SessionProvider>);await screen.findByText('João <>&');fireEvent.click(screen.getByText('Sair'));await screen.findByText('anonymous');expect(screen.queryByText('João <>&')).not.toBeInTheDocument();
  expect(fetch.mock.calls[1][1].headers['X-CSRF-Token']).toBe('csrf');
 });
 it('resposta antiga não restaura perfil depois de uma consulta mais nova',async()=>{
  let finish!:(r:Response)=>void;
  const fetch=vi.fn().mockReturnValueOnce(new Promise<Response>(resolve=>{finish=resolve;})).mockResolvedValueOnce(response(401,{}));vi.stubGlobal('fetch',fetch);
  render(<SessionProvider><Probe/></SessionProvider>);fireEvent.click(screen.getByText('Atualizar'));await screen.findByText('anonymous');
  finish(response(200,{user:{firstName:'Antigo'},csrfToken:'old'}));await waitFor(()=>expect(screen.getByText('anonymous')).toBeInTheDocument());expect(screen.queryByText('Antigo')).not.toBeInTheDocument();
 });
 it('consulta iniciada durante logout não restaura a sessão encerrada',async()=>{
  let finishLogout!:(r:Response)=>void,finishRefresh!:(r:Response)=>void;
  const data={user:{firstName:'João',lastName:null,username:null},csrfToken:'csrf'};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response(200,data)).mockReturnValueOnce(new Promise<Response>(r=>{finishLogout=r;})).mockReturnValueOnce(new Promise<Response>(r=>{finishRefresh=r;})));
  render(<SessionProvider><Probe/></SessionProvider>);await screen.findByText('authenticated');fireEvent.click(screen.getByText('Sair'));fireEvent.click(screen.getByText('Atualizar'));
  await act(async()=>{finishLogout(response(200,{ok:true}));});await screen.findByText('anonymous');
  await act(async()=>{finishRefresh(response(200,data));});expect(screen.getByText('anonymous')).toBeInTheDocument();
 });
 it('resposta perdida do logout oculta perfil e invalida refresh até reconciliação',async()=>{
  let loseResponse!:(e:Error)=>void,finishRefresh!:(r:Response)=>void;
  const data={user:{firstName:'João',lastName:null,username:null},csrfToken:'csrf'};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response(200,data)).mockReturnValueOnce(new Promise<Response>((_,reject)=>{loseResponse=reject;})).mockReturnValueOnce(new Promise<Response>(r=>{finishRefresh=r;})).mockResolvedValueOnce(response(401,{})));
  render(<SessionProvider><Probe/></SessionProvider>);await screen.findByText('authenticated');fireEvent.click(screen.getByText('Sair'));fireEvent.click(screen.getByText('Atualizar'));
  await act(async()=>{loseResponse(new Error('Response lost after server commit'));});expect(screen.getByText('error')).toBeInTheDocument();expect(screen.queryByText('João')).not.toBeInTheDocument();
  await act(async()=>{finishRefresh(response(200,data));});expect(screen.getByText('error')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Atualizar'));await screen.findByText('anonymous');
 });
});
