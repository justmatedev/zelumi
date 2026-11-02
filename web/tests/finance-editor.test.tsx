import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {RecordEditor} from '@/components/finance/record-editor';
import {RecordDialog} from '@/components/finance/record-dialog';
import {SessionProvider} from '@/components/session-provider';
const record={id:'1',version:'a'.repeat(64),description:'Google',type:'despesa' as const,category:'Outros',amount:100000,date:'2026-01-31',installments:12,installmentStartMonth:null,schedule:[]};
it('edição usa total, avisa sobre todos os meses e mantém texto em conflito',async()=>{
 const save=vi.fn().mockRejectedValue(new Error('Conflito'));render(<RecordEditor record={record} onSave={save} onCancel={()=>{}} busy={false}/>);
 expect(screen.getByText(/meses anteriores/)).toBeInTheDocument();fireEvent.change(screen.getByLabelText('Nome'),{target:{value:'Google editado'}});fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));await waitFor(()=>expect(save).toHaveBeenCalledOnce());expect(screen.getByLabelText('Nome')).toHaveValue('Google editado');expect(save.mock.calls[0][0].amount).toBe(100000);
});
it('trocar de conta oculta editor e ignora conclusão da conta anterior',async()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.open=true;}});let finish!:(r:Response)=>void;
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({user:{firstName:'Conta A',username:null,lastName:null},csrfToken:'csrf-A'}))).mockResolvedValueOnce(new Response(JSON.stringify(record))).mockReturnValueOnce(new Promise<Response>(r=>{finish=r;})).mockResolvedValueOnce(new Response(JSON.stringify({user:{firstName:'Conta B',username:null,lastName:null},csrfToken:'csrf-B'}))));
 const changed=vi.fn();render(<SessionProvider><RecordDialog id="1" onClose={()=>{}} onChanged={changed}/></SessionProvider>);fireEvent.click(await screen.findByRole('button',{name:'Editar'}));fireEvent.change(screen.getByLabelText('Nome'),{target:{value:'Despesa privada de A'}});fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));
 fireEvent(window,new Event('focus'));await waitFor(()=>expect(screen.queryByDisplayValue('Despesa privada de A')).not.toBeInTheDocument());
 await act(async()=>{finish(new Response(JSON.stringify({ok:true})));});expect(changed).not.toHaveBeenCalled();
});
it('resposta perdida exige verificar e reutiliza a chave ao reenviar',async()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.open=true;}});
 const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({user:{firstName:'Teste',username:null,lastName:null},csrfToken:'csrf'}))).mockResolvedValueOnce(new Response(JSON.stringify(record))).mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce(new Response(JSON.stringify(record))).mockResolvedValueOnce(new Response(JSON.stringify({ok:true})));
 vi.stubGlobal('fetch',fetch);const changed=vi.fn();render(<SessionProvider><RecordDialog id="1" onClose={()=>{}} onChanged={changed}/></SessionProvider>);
 fireEvent.click(await screen.findByRole('button',{name:'Editar'}));fireEvent.change(screen.getByLabelText('Nome'),{target:{value:'Google corrigido'}});fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));
 const retry=await screen.findByRole('button',{name:'Reenviar mesma ação'});expect(retry).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Verificar resultado'}));await waitFor(()=>expect(retry).toBeEnabled());fireEvent.click(retry);await waitFor(()=>expect(changed).toHaveBeenCalledOnce());
 expect(fetch.mock.calls[2][1].headers['Idempotency-Key']).toBe(fetch.mock.calls[4][1].headers['Idempotency-Key']);
});
