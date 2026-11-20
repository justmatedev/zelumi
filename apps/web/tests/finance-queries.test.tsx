import {it,expect,vi} from 'vitest';
import {render,screen,act,fireEvent,waitFor} from '@testing-library/react';
import {useFinance} from '@/features/finance/hooks/use-finance';
import {SessionProvider} from '@/features/auth/providers/session-provider';
import {Overview} from '@/features/finance/components/overview';
import {History} from '@/features/finance/components/history';
const session={user:{firstName:'Teste',lastName:null,username:null},csrfToken:'csrf'};
function Probe({path,cached=false,prefetch=[]}:{path:string;cached?:boolean;prefetch?:string[]}){const q=useFinance<{label:string}>(path,{cache:cached,prefetch});return <><span>{q.data?.label}</span><span>{q.error?.code}</span><button onClick={q.refresh}>Atualizar</button></>;}
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
it('filtros próprios enviam categoria e mês e permitem limpar o período',async()=>{
 const fetch=vi.fn().mockImplementation((path:string)=>Promise.resolve(new Response(JSON.stringify(path==='/api/session'?session:{items:[],total:0,page:1,pageSize:20,snapshot:1,categories:[]}))));vi.stubGlobal('fetch',fetch);
 render(<SessionProvider><History/></SessionProvider>);
 fireEvent.click(screen.getByRole('button',{name:'Filtros'}));
 fireEvent.click(screen.getByRole('combobox',{name:'Categoria'}));
 fireEvent.click(await screen.findByRole('option',{name:'Pets'}));
 await waitFor(()=>expect(fetch.mock.calls.some(([path])=>String(path).includes('category=Pets'))).toBe(true));
 fireEvent.click(screen.getByRole('button',{name:'Filtrar mês'}));
 fireEvent.change(screen.getByRole('spinbutton',{name:'Ano'}),{target:{value:'2027'}});
 fireEvent.click(screen.getByRole('button',{name:'Fevereiro'}));
 await waitFor(()=>expect(fetch.mock.calls.some(([path])=>String(path).includes('month=2027-02'))).toBe(true));
 fireEvent.click(screen.getByRole('button',{name:'Filtrar mês'}));
 fireEvent.click(screen.getByRole('button',{name:'Limpar período'}));
 await waitFor(()=>expect(String(fetch.mock.calls.at(-1)?.[0])).not.toContain('month='));
});

it('voltar a um mês recente usa os dados imediatamente sem outra consulta',async()=>{
 const november='/api/finance/overview?month=2026-11',december='/api/finance/overview?month=2026-12';
 const fetch=vi.fn().mockImplementation((path:string)=>Promise.resolve(new Response(JSON.stringify(path==='/api/session'?session:{label:path===november?'Novembro':'Dezembro'}))));
 vi.stubGlobal('fetch',fetch);
 const view=render(<SessionProvider><Probe cached path={november}/></SessionProvider>);
 await screen.findByText('Novembro');
 view.rerender(<SessionProvider><Probe cached path={december}/></SessionProvider>);await screen.findByText('Dezembro');
 view.rerender(<SessionProvider><Probe cached path={november}/></SessionProvider>);
 expect(screen.getByText('Novembro')).toBeInTheDocument();
 expect(fetch.mock.calls.filter(([path])=>path===november)).toHaveLength(1);
});
it('antecipa o mês vizinho e o exibe sem estado vazio ao selecionar',async()=>{
 const november='/api/finance/overview?month=2026-11',december='/api/finance/overview?month=2026-12';
 const fetch=vi.fn().mockImplementation((path:string)=>Promise.resolve(new Response(JSON.stringify(path==='/api/session'?session:{label:path===november?'Novembro':'Dezembro'}))));
 vi.stubGlobal('fetch',fetch);
 const view=render(<SessionProvider><Probe cached path={november} prefetch={[december]}/></SessionProvider>);
 await screen.findByText('Novembro');
 await waitFor(()=>expect(fetch.mock.calls.some(([path])=>path===december)).toBe(true));await act(async()=>{});
 view.rerender(<SessionProvider><Probe cached path={december}/></SessionProvider>);
 expect(screen.getByText('Dezembro')).toBeInTheDocument();
 expect(fetch.mock.calls.filter(([path])=>path===december)).toHaveLength(1);
});
it.each(['manual','focus'])('atualização por %s invalida os outros meses guardados',async(trigger)=>{
 const november='/api/finance/overview?month=2026-11',december='/api/finance/overview?month=2026-12';let updated=false;
 vi.stubGlobal('fetch',vi.fn().mockImplementation((path:string)=>Promise.resolve(new Response(JSON.stringify(path==='/api/session'?session:{label:path===november?'Novembro':updated?'Dezembro corrigido':'Dezembro antigo'})))));
 const view=render(<SessionProvider><Probe cached path={november}/></SessionProvider>);await screen.findByText('Novembro');
 view.rerender(<SessionProvider><Probe cached path={december}/></SessionProvider>);await screen.findByText('Dezembro antigo');
 view.rerender(<SessionProvider><Probe cached path={november}/></SessionProvider>);await screen.findByText('Novembro');
 updated=true;
 if(trigger==='manual')fireEvent.click(screen.getByText('Atualizar'));else fireEvent(window,new Event('focus'));
 await act(async()=>{});
 view.rerender(<SessionProvider><Probe cached path={december}/></SessionProvider>);
 expect(screen.queryByText('Dezembro antigo')).not.toBeInTheDocument();await screen.findByText('Dezembro corrigido');
});
it('um mês guardado expira e volta a consultar sem exibir valores antigos',async()=>{
 const november='/api/finance/overview?month=2026-11',december='/api/finance/overview?month=2026-12';let updated=false;
 vi.stubGlobal('fetch',vi.fn().mockImplementation((path:string)=>Promise.resolve(new Response(JSON.stringify(path==='/api/session'?session:{label:path===november?(updated?'Novembro corrigido':'Novembro antigo'):'Dezembro'})))));
 const view=render(<SessionProvider><Probe cached path={november}/></SessionProvider>);await screen.findByText('Novembro antigo');
 view.rerender(<SessionProvider><Probe cached path={december}/></SessionProvider>);await screen.findByText('Dezembro');
 const now=Date.now();vi.spyOn(Date,'now').mockReturnValue(now+31_000);updated=true;
 view.rerender(<SessionProvider><Probe cached path={november}/></SessionProvider>);
 expect(screen.queryByText('Novembro antigo')).not.toBeInTheDocument();await screen.findByText('Novembro corrigido');
});
it('trocar de conta descarta também os meses antecipados',async()=>{
 const november='/api/finance/overview?month=2026-11',december='/api/finance/overview?month=2026-12';let account=session;
 const fetch=vi.fn().mockImplementation((path:string)=>Promise.resolve(new Response(JSON.stringify(path==='/api/session'?account:{label:account===session?(path===november?'Novembro de A':'Dezembro de A'):'Dados de B'}))));
 vi.stubGlobal('fetch',fetch);
 const view=render(<SessionProvider><Probe cached path={november} prefetch={[december]}/></SessionProvider>);await screen.findByText('Novembro de A');
 await waitFor(()=>expect(fetch.mock.calls.some(([path])=>path===december)).toBe(true));await act(async()=>{});
 account={...session,csrfToken:'csrf-B'};fireEvent(window,new Event('focus'));await screen.findByText('Dados de B');
 view.rerender(<SessionProvider><Probe cached path={december}/></SessionProvider>);
 expect(screen.queryByText('Dezembro de A')).not.toBeInTheDocument();await screen.findByText('Dados de B');
});
it('uma antecipação atrasada não restaura dados invalidados por Atualizar',async()=>{
 const november='/api/finance/overview?month=2026-11',december='/api/finance/overview?month=2026-12';let finish!:(r:Response)=>void,requests=0;
 vi.stubGlobal('fetch',vi.fn().mockImplementation((path:string)=>{
  if(path===december&&++requests===1)return new Promise<Response>(resolve=>{finish=resolve;});
  return Promise.resolve(new Response(JSON.stringify(path==='/api/session'?session:{label:path===november?'Novembro':'Dezembro corrigido'})));
 }));
 const view=render(<SessionProvider><Probe cached path={november} prefetch={[december]}/></SessionProvider>);await screen.findByText('Novembro');
 await waitFor(()=>expect(finish).toBeTypeOf('function'));
 fireEvent.click(screen.getByText('Atualizar'));await act(async()=>{});
 await act(async()=>{finish(new Response(JSON.stringify({label:'Dezembro antigo'})));});
 view.rerender(<SessionProvider><Probe cached path={december}/></SessionProvider>);
 expect(screen.queryByText('Dezembro antigo')).not.toBeInTheDocument();await screen.findByText('Dezembro corrigido');
});

it('a Visão geral antecipa a virada do ano e mantém o foco ao trocar sem carregamento',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-12-15T12:00:00Z'));
 try{
  const fetch=vi.fn().mockImplementation((path:string)=>{
   const month=new URL(path,'https://localhost').searchParams.get('month');
   return Promise.resolve(new Response(JSON.stringify(path==='/api/session'?session:{month,snapshot:1,count:0,income:month==='2027-01'?90000:70000,expense:10000,result:month==='2027-01'?80000:60000,installmentExpense:0,cashExpense:10000,recent:[],categories:[]})));
  });vi.stubGlobal('fetch',fetch);
  render(<SessionProvider><Overview/></SessionProvider>);
  await screen.findByText(/700,00/);
  await waitFor(()=>expect(fetch.mock.calls.some(([path])=>path==='/api/finance/overview?month=2027-01')).toBe(true));await act(async()=>{});
  const next=screen.getByRole('button',{name:'Próximo mês'});next.focus();
  fireEvent.click(next,{detail:0});
  expect(screen.getByText(/900,00/)).toBeInTheDocument();
  expect(screen.queryByText('Carregando seu mês…')).not.toBeInTheDocument();expect(next).toHaveFocus();
  expect(fetch.mock.calls.filter(([path])=>path==='/api/finance/overview?month=2027-01')).toHaveLength(1);
 }finally{vi.useRealTimers();}
});
