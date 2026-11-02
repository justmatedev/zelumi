import {it,expect,vi} from 'vitest';
import {render,screen,act,fireEvent,waitFor} from '@testing-library/react';
import {useFinance} from '@/hooks/use-finance';
import {SessionProvider} from '@/components/session-provider';
import {History} from '@/components/finance/history';
const session={user:{firstName:'Teste',lastName:null,username:null},csrfToken:'csrf'};
function Probe({path}:{path:string}){const q=useFinance<{label:string}>(path);return <><span>{q.data?.label}</span><span>{q.error?.code}</span><button onClick={q.refresh}>Atualizar</button></>;}
it.each(['focus','manual'])('mantém dados visíveis durante atualização por %s',async(trigger)=>{
 let finish!:(r:Response)=>void;
 let requests=0;
 vi.stubGlobal('fetch',vi.fn().mockImplementation((path:string)=>{
  if(path==='/api/session')return Promise.resolve(new Response(JSON.stringify(session)));
  if(++requests===1)return Promise.resolve(new Response(JSON.stringify({label:'Dados atuais'})));
  return new Promise<Response>(r=>{finish=r;});
 }));
 render(<SessionProvider><Probe path="/api/finance/overview?month=2026-11"/></SessionProvider>);
 await screen.findByText('Dados atuais');
 if(trigger==='focus')fireEvent(window,new Event('focus'));else fireEvent.click(screen.getByText('Atualizar'));
 expect(screen.getByText('Dados atuais')).toBeInTheDocument();
 await act(async()=>{finish(new Response(JSON.stringify({label:'Dados atualizados'})));});
 await screen.findByText('Dados atualizados');expect(screen.queryByText('Dados atuais')).not.toBeInTheDocument();
});
it('trocar o mês oculta dados do mês anterior durante a busca',async()=>{
 let finish!:(r:Response)=>void;
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(session))).mockResolvedValueOnce(new Response(JSON.stringify({label:'Novembro'}))).mockReturnValueOnce(new Promise<Response>(r=>{finish=r;})));
 const view=render(<SessionProvider><Probe path="/api/finance/overview?month=2026-11"/></SessionProvider>);
 await screen.findByText('Novembro');
 view.rerender(<SessionProvider><Probe path="/api/finance/overview?month=2026-12"/></SessionProvider>);
 expect(screen.queryByText('Novembro')).not.toBeInTheDocument();
 await act(async()=>{finish(new Response(JSON.stringify({label:'Dezembro'})));});await screen.findByText('Dezembro');
});
it('trocar de conta oculta os dados anteriores e ignora sua resposta pendente',async()=>{
 let account=session,requests=0;
 const pending:Array<(r:Response)=>void>=[];
 vi.stubGlobal('fetch',vi.fn().mockImplementation((path:string)=>{
  if(path==='/api/session')return Promise.resolve(new Response(JSON.stringify(account)));
  if(++requests===1)return Promise.resolve(new Response(JSON.stringify({label:'Privado de A'})));
  return new Promise<Response>(r=>{pending.push(r);});
 }));
 render(<SessionProvider><Probe path="/api/finance/entries"/></SessionProvider>);
 await screen.findByText('Privado de A');
 account={...session,csrfToken:'csrf-B'};fireEvent(window,new Event('focus'));
 await waitFor(()=>expect(screen.queryByText('Privado de A')).not.toBeInTheDocument());
 await act(async()=>{pending[0](new Response(JSON.stringify({label:'Resposta atrasada de A'})));});
 expect(screen.queryByText('Resposta atrasada de A')).not.toBeInTheDocument();
 await act(async()=>{pending[1](new Response(JSON.stringify({label:'Dados de B'})));});
 await screen.findByText('Dados de B');expect(screen.queryByText('Privado de A')).not.toBeInTheDocument();
});
it('resposta antiga da busca não substitui a consulta atual',async()=>{
 let old!:(r:Response)=>void;
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(session))).mockReturnValueOnce(new Promise<Response>(r=>{old=r;})).mockResolvedValueOnce(new Response(JSON.stringify({label:'Nova'}))));
 const view=render(<SessionProvider><Probe path="/api/finance/entries?q=A"/></SessionProvider>);await act(async()=>{});
 view.rerender(<SessionProvider><Probe path="/api/finance/entries?q=B"/></SessionProvider>);await screen.findByText('Nova');
 await act(async()=>{old(new Response(JSON.stringify({label:'Antiga'})));});expect(screen.queryByText('Antiga')).not.toBeInTheDocument();
});
it('mudança de snapshot entre páginas volta ao início e informa a atualização',async()=>{
 const data={items:[],total:25,page:1,pageSize:20,snapshot:1,categories:[]};
 vi.stubGlobal('fetch',vi.fn().mockImplementation((path:string)=>Promise.resolve(new Response(JSON.stringify(path==='/api/session'?session:path.includes('page=2')?{error:'O histórico mudou.',code:'HISTORY_CHANGED'}:data),{status:path.includes('page=2')?409:200}))));
 render(<SessionProvider><History/></SessionProvider>);const next=await screen.findByRole('button',{name:'Próxima página'});fireEvent.click(next);await screen.findByText('O histórico mudou.');await waitFor(()=>expect(screen.getByRole('button',{name:'Página anterior'})).toBeDisabled());
});
it('401 remove dados já carregados e não permite voltar por resposta atrasada',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(session))).mockResolvedValueOnce(new Response(JSON.stringify({label:'Privado'}))).mockResolvedValueOnce(new Response(JSON.stringify({error:'Expirou'}),{status:401})));
 render(<SessionProvider><Probe path="/api/finance/entries"/></SessionProvider>);await screen.findByText('Privado');fireEvent.click(screen.getByText('Atualizar'));await act(async()=>{});expect(screen.queryByText('Privado')).not.toBeInTheDocument();
});
it('busca mantém rótulo visível acima do campo mesmo quando preenchido',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockImplementation((path:string)=>Promise.resolve(new Response(JSON.stringify(path==='/api/session'?session:{items:[],total:0,page:1,pageSize:20,snapshot:1,categories:[]})))));
 render(<SessionProvider><History/></SessionProvider>);
 const input=screen.getByRole('textbox',{name:'Buscar pelo nome da compra ou receita'}) as HTMLInputElement;
 expect(Array.from(input.labels||[]).some(label=>label.textContent?.includes('Buscar pelo nome'))).toBe(true);
 fireEvent.change(input,{target:{value:'Mercado'}});
 expect(input).toHaveValue('Mercado');
 expect(Array.from(input.labels||[]).some(label=>label.textContent?.includes('Buscar pelo nome'))).toBe(true);
});
