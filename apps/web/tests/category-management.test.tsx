import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {CategoryManagement} from '@/features/profile/components/category-management';
import {SessionProvider} from '@/features/auth/providers/session-provider';
const session={user:{firstName:'Teste'},csrfToken:'csrf'};
it('confirma termo sugerido explicitamente e permite esquecer associação própria',async()=>{
 const changes:Array<{path:string;method:string;body:Record<string,unknown>}>=[];
 vi.stubGlobal('fetch',vi.fn().mockImplementation((path:string,init?:RequestInit)=>{
  if(path==='/api/session')return Promise.resolve(new Response(JSON.stringify(session)));
  if(init?.method==='PUT'||init?.method==='DELETE'){changes.push({path,method:init.method,body:JSON.parse(String(init.body))});return Promise.resolve(new Response(JSON.stringify({ok:true})));}
  return Promise.resolve(new Response(JSON.stringify({items:[{key:'bambi',category:'Alimentação',revision:2}],nextPage:null,suggestions:path.includes('category-terms')?[{phrase:'sorvete',category:'Alimentação',examples:3}]:[]})));
 }));
 render(<SessionProvider><CategoryManagement/></SessionProvider>);
 fireEvent.click(await screen.findByRole('button',{name:'Esquecer associação bambi'}));await waitFor(()=>expect(changes).toHaveLength(1));expect(changes[0].body.expectedRevision).toBe(2);
 fireEvent.click(screen.getByRole('radio',{name:'Termos'}));fireEvent.click(await screen.findByRole('button',{name:'Confirmar termo sorvete'}));
 await waitFor(()=>expect(changes).toHaveLength(2));expect(changes[1].body).toEqual({key:'sorvete',category:'Alimentação',expectedRevision:null});expect(changes[1].method).toBe('PUT');
});
it('resposta perdida mantém operação e verifica recibo antes de permitir reenvio',async()=>{
 let key='';const fetch=vi.fn().mockImplementation((path:string,init?:RequestInit)=>{
  if(path==='/api/session')return Promise.resolve(new Response(JSON.stringify(session)));
  if(init?.method==='DELETE'){key=(init.headers as Record<string,string>)['Idempotency-Key'];return Promise.reject(new Error('lost'));}
  if(path.startsWith('/api/finance/operations/')){expect(path).toContain(key);return Promise.resolve(new Response(JSON.stringify({found:true,response:{ok:true}})));}
  return Promise.resolve(new Response(JSON.stringify({items:[{key:'bambi',category:'Alimentação',revision:1}],nextPage:null,suggestions:[]})));
 });vi.stubGlobal('fetch',fetch);
 render(<SessionProvider><CategoryManagement/></SessionProvider>);
 fireEvent.click(await screen.findByRole('button',{name:'Esquecer associação bambi'}));const retry=await screen.findByRole('button',{name:'Reenviar mesma ação'});expect(retry).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Verificar resultado'}));await screen.findByText('Associação atualizada.');
});
