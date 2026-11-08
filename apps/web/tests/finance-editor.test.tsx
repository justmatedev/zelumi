import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {RecordEditor} from '@/features/finance/components/record-editor';
import {RecordDialog} from '@/features/finance/components/record-dialog';
import {SessionProvider} from '@/features/auth/providers/session-provider';
const record={id:'1',version:'a'.repeat(64),description:'Google',type:'despesa' as const,category:'Outros',amount:100000,date:'2026-01-31',installments:12,installmentStartMonth:null,schedule:[]};
it('oferece categorias completas, preserva categoria ao renomear e salva seleção explícita',async()=>{
 const save=vi.fn().mockResolvedValue(undefined);
 render(<RecordEditor record={{...record,description:'Netflix'}} onSave={save} onCancel={()=>{}} busy={false}/>);
 const categoryTrigger=screen.getByRole('combobox',{name:'Categoria'});
 expect(categoryTrigger).toHaveTextContent('Outros');
 fireEvent.click(categoryTrigger);
 for(const category of ['Educação','Lazer','Compras','Assinaturas','Cuidados pessoais','Pets','Viagens','Impostos e taxas']){
  expect(screen.getByRole('option',{name:category})).toBeInTheDocument();
 }
 fireEvent.keyDown(screen.getByRole('listbox'),{key:'Escape'});
 fireEvent.change(screen.getByLabelText('Nome'),{target:{value:'Netflix mensal'}});
 fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));
 await waitFor(()=>expect(save).toHaveBeenCalledOnce());
 expect(save.mock.calls[0][0].category).toBe('Outros');
 fireEvent.click(categoryTrigger);
 fireEvent.click(await screen.findByRole('option',{name:'Impostos e taxas'}));
 fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));
 await waitFor(()=>expect(save).toHaveBeenCalledTimes(2));
 expect(save.mock.calls[1][0].category).toBe('Impostos e taxas');
 fireEvent.click(screen.getByRole('radio',{name:'Receita'}));
 expect(categoryTrigger).toHaveTextContent('Receitas');
 fireEvent.click(categoryTrigger);
 expect(screen.queryByRole('option',{name:'Pets'})).not.toBeInTheDocument();
});
it('data impossível não salva a data anterior e controles ficam bloqueados ao salvar',async()=>{
 const save=vi.fn();const view=render(<RecordEditor record={record} onSave={save} onCancel={()=>{}} busy={false}/>);
 fireEvent.change(screen.getByRole('textbox',{name:'Data da compra'}),{target:{value:'31/02/2026'}});
 fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));
 expect(save).not.toHaveBeenCalled();
 view.rerender(<RecordEditor record={record} onSave={save} onCancel={()=>{}} busy/>);
 expect(screen.getByRole('combobox',{name:'Categoria'})).toBeDisabled();
 expect(screen.getByRole('radio',{name:'Receita'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Mês da primeira parcela'})).toBeDisabled();
});
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
 const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({user:{firstName:'Teste',username:null,lastName:null},csrfToken:'csrf'}))).mockResolvedValueOnce(new Response(JSON.stringify(record))).mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce(new Response(JSON.stringify({found:false}))).mockResolvedValueOnce(new Response(JSON.stringify(record))).mockResolvedValueOnce(new Response(JSON.stringify({ok:true})));
 vi.stubGlobal('fetch',fetch);const changed=vi.fn();render(<SessionProvider><RecordDialog id="1" onClose={()=>{}} onChanged={changed}/></SessionProvider>);
 fireEvent.click(await screen.findByRole('button',{name:'Editar'}));fireEvent.change(screen.getByLabelText('Nome'),{target:{value:'Google corrigido'}});fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));
 const retry=await screen.findByRole('button',{name:'Reenviar mesma ação'});expect(retry).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Verificar resultado'}));await waitFor(()=>expect(retry).toBeEnabled());fireEvent.click(retry);await waitFor(()=>expect(changed).toHaveBeenCalledOnce());
 expect(fetch.mock.calls[2][1].headers['Idempotency-Key']).toBe(fetch.mock.calls[5][1].headers['Idempotency-Key']);
});
it('só aprende categoria após escolha explícita e permite lembrar Outros ou esquecer associação',async()=>{
 const save=vi.fn().mockResolvedValue(undefined);
 render(<RecordEditor record={{...record,categoryMemory:{category:'Pets',revision:1}}} onSave={save} onCancel={()=>{}} busy={false}/>);
 expect(screen.getByRole('checkbox',{name:'Lembrar categoria para esta descrição'})).not.toBeChecked();
 fireEvent.click(screen.getByRole('combobox',{name:'Categoria'}));fireEvent.click(await screen.findByRole('option',{name:'Compras'}));
 expect(screen.getByRole('checkbox',{name:'Lembrar categoria para esta descrição'})).toBeChecked();
 fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));await waitFor(()=>expect(save).toHaveBeenCalledOnce());expect(save.mock.calls[0][1]).toBe('remember');
 fireEvent.click(screen.getByRole('checkbox',{name:'Lembrar categoria para esta descrição'}));
 fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(2));expect(save.mock.calls[1][1]).toBe('keep');
 fireEvent.click(screen.getByRole('button',{name:'Esquecer associação'}));fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(3));expect(save.mock.calls[2][1]).toBe('forget');
});
it('recibo completo confirma salvamento de memória mesmo sem mudança financeira',async()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.open=true;}});
 const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({user:{firstName:'Teste'},csrfToken:'csrf'}))).mockResolvedValueOnce(new Response(JSON.stringify(record))).mockRejectedValueOnce(new Error('lost')).mockResolvedValueOnce(new Response(JSON.stringify({found:true,response:{ok:true}})));
 vi.stubGlobal('fetch',fetch);const changed=vi.fn();render(<SessionProvider><RecordDialog id="1" onClose={()=>{}} onChanged={changed}/></SessionProvider>);
 fireEvent.click(await screen.findByRole('button',{name:'Editar'}));fireEvent.click(screen.getByRole('checkbox',{name:'Lembrar categoria para esta descrição'}));fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));
 fireEvent.click(await screen.findByRole('button',{name:'Verificar resultado'}));await waitFor(()=>expect(changed).toHaveBeenCalledOnce());
 expect(String(fetch.mock.calls[3][0])).toContain('/api/finance/operations/');
});
