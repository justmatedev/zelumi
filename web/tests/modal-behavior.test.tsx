import {useRef,useState} from 'react';
import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {useModalScrollLock,useDialogBackdrop} from '@/hooks/use-modal';
import {RecordDialog} from '@/components/finance/record-dialog';
import {SessionProvider} from '@/components/session-provider';

function Probe({active=true,onClose=()=>{},busy=false}:{active?:boolean;onClose?:()=>void;busy?:boolean}){
 useModalScrollLock(active);
 const backdrop=useDialogBackdrop(onClose,busy),ref=useRef<HTMLDialogElement>(null);
 return <dialog open ref={ref} {...backdrop}><button>Conteúdo</button></dialog>;
}
const bounds={left:100,right:400,top:100,bottom:400,width:300,height:300,x:100,y:100,toJSON:()=>({})};
function outside(dialog:HTMLElement){fireEvent.pointerDown(dialog,{clientX:50,clientY:50});fireEvent.click(dialog,{clientX:50,clientY:50});}

it('bloqueia o fundo e restaura estilos e posição somente após fechar o último modal',()=>{
 const scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 Object.defineProperty(window,'scrollY',{configurable:true,value:240});
 document.body.style.overflow='auto';
 document.body.style.paddingRight='5px';
 const first=render(<Probe/>),second=render(<Probe/>);
 expect(document.documentElement.style.overflow).toBe('hidden');
 expect(document.body.style.position).toBe('fixed');expect(document.body.style.top).toBe('-240px');
 first.unmount();expect(document.body.style.position).toBe('fixed');
 second.unmount();
 expect(document.body.style.overflow).toBe('auto');expect(document.body.style.paddingRight).toBe('5px');
 expect(document.body.style.position).toBe('');expect(document.documentElement.style.overflow).toBe('');
 expect(scroll).toHaveBeenCalledWith({left:0,top:240,behavior:'instant'});
 document.body.style.overflow='';document.body.style.paddingRight='';
 Object.defineProperty(window,'scrollY',{configurable:true,value:0});
});

it('fecha apenas se o gesto começar e terminar no fundo, preservando conteúdo e padding',()=>{
 const close=vi.fn();const view=render(<Probe onClose={close}/>);
 const dialog=view.container.querySelector('dialog')!;vi.spyOn(dialog,'getBoundingClientRect').mockReturnValue(bounds);
 fireEvent.click(screen.getByRole('button',{name:'Conteúdo'}));
 fireEvent.pointerDown(dialog,{clientX:110,clientY:110});fireEvent.click(dialog,{clientX:110,clientY:110});
 fireEvent.pointerDown(dialog,{clientX:110,clientY:110});fireEvent.click(dialog,{clientX:50,clientY:50});
 expect(close).not.toHaveBeenCalled();
 outside(dialog);expect(close).toHaveBeenCalledOnce();
});

it('não fecha pelo fundo durante uma operação',()=>{
 const close=vi.fn();const view=render(<Probe onClose={close} busy/>);
 const dialog=view.container.querySelector('dialog')!;vi.spyOn(dialog,'getBoundingClientRect').mockReturnValue(bounds);
 outside(dialog);expect(close).not.toHaveBeenCalled();
});

it('modal de lançamento libera o fundo ao fechar pelo clique externo',async()=>{
 vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.open=true;}});
 vi.stubGlobal('fetch',vi.fn().mockImplementation((path:string)=>Promise.resolve(new Response(JSON.stringify(path==='/api/session'?{user:{firstName:'Teste'},csrfToken:'csrf'}:{id:'1',description:'Teste',type:'despesa',category:'Outros',amount:1000,date:'2026-11-01',installments:1,schedule:[],version:'a'.repeat(64)})))));
 function Example(){const [id,setId]=useState<string|null>('1');return <SessionProvider><RecordDialog id={id} onClose={()=>setId(null)} onChanged={()=>{}}/></SessionProvider>;}
 render(<Example/>);
 const dialog=await screen.findByRole('dialog');vi.spyOn(dialog,'getBoundingClientRect').mockReturnValue(bounds);
 expect(document.body.style.position).toBe('fixed');
 outside(dialog);
 await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
 expect(document.body.style.position).toBe('');expect(document.documentElement.style.overflow).toBe('');
});
