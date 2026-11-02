import {it,expect,vi} from 'vitest';
import {render,screen,act,fireEvent,waitFor} from '@testing-library/react';
import {useFinance} from '@/hooks/use-finance';
import {SessionProvider} from '@/components/session-provider';
import {History} from '@/components/finance/history';
const session={user:{firstName:'Teste',lastName:null,username:null},csrfToken:'csrf'};
function Probe({path}:{path:string}){const q=useFinance<{label:string}>(path);return <><span>{q.data?.label}</span><span>{q.error?.code}</span><button onClick={q.refresh}>Atualizar</button></>;}
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
