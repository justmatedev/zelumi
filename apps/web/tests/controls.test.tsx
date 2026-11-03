import {useState} from 'react';
import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {Select} from '@/components/ui/select';
import {SegmentedControl} from '@/components/ui/segmented-control';
import {NumberField} from '@/components/ui/number-field';
import {DateField,MonthField} from '@/components/ui/date-field';

it('menu próprio permite selecionar, limpar e voltar ao acionador com Escape',async()=>{
 function Example(){const [value,setValue]=useState('');return <Select aria-label="Categoria" value={value} onValueChange={setValue} options={[{value:'',label:'Todas as categorias'},{value:'Pets',label:'Pets'},{value:'Impostos e taxas',label:'Impostos e taxas'}]}/>;}
 render(<Example/>);
 const trigger=screen.getByRole('combobox',{name:'Categoria'});
 fireEvent.click(trigger);
 fireEvent.click(await screen.findByRole('option',{name:'Impostos e taxas'}));
 expect(trigger).toHaveTextContent('Impostos e taxas');
 fireEvent.click(trigger);fireEvent.keyDown(await screen.findByRole('listbox'),{key:'Escape'});
 await waitFor(()=>expect(trigger).toHaveFocus());
 fireEvent.click(trigger);fireEvent.click(await screen.findByRole('option',{name:'Todas as categorias'}));
 expect(trigger).toHaveTextContent('Todas as categorias');
});

it('tipo usa radios com estado selecionado e respeita desabilitado',()=>{
 const change=vi.fn();
 render(<SegmentedControl aria-label="Tipo" value="despesa" onValueChange={change} options={[{value:'despesa',label:'Despesa'},{value:'receita',label:'Receita'}]}/>);
 expect(screen.getByRole('radio',{name:'Despesa'})).toBeChecked();
 fireEvent.click(screen.getByRole('radio',{name:'Receita'}));expect(change).toHaveBeenCalledWith('receita');
});

it('controle de parcelas respeita limites e não submete o formulário',()=>{
 const submit=vi.fn(e=>e.preventDefault());
 function Example(){const [value,setValue]=useState(1);return <form onSubmit={submit}><NumberField aria-label="Parcelas" value={value} onValueChange={setValue} min={1} max={2}/></form>;}
 render(<Example/>);
 expect(screen.getByRole('button',{name:'Diminuir Parcelas'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Aumentar Parcelas'}));
 expect(screen.getByRole('spinbutton',{name:'Parcelas'})).toHaveValue(2);
 expect(screen.getByRole('button',{name:'Aumentar Parcelas'})).toBeDisabled();
 expect(submit).not.toHaveBeenCalled();
});

it('data permite digitar em português e invalida data impossível sem manter valor antigo',()=>{
 const change=vi.fn();
 render(<DateField aria-label="Data da compra" value="2026-11-01" onValueChange={change} min="1900-01-01" max="9990-12-31" required/>);
 const input=screen.getByRole('textbox',{name:'Data da compra'});
 expect(input).toHaveValue('01/11/2026');
 fireEvent.change(input,{target:{value:'31/02/2026'}});
 expect(change).toHaveBeenLastCalledWith('');expect(input).toHaveAttribute('aria-invalid','true');
 fireEvent.change(input,{target:{value:'28/02/2026'}});
 expect(change).toHaveBeenLastCalledWith('2026-02-28');
});

it('calendário abre em português e seleciona um dia',async()=>{
 const change=vi.fn();render(<DateField aria-label="Data da compra" value="2026-11-01" onValueChange={change}/>);
 fireEvent.click(screen.getByRole('button',{name:'Abrir calendário: Data da compra'}));
 expect(await screen.findByRole('dialog',{name:'Escolher Data da compra'})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/segunda-feira, 2 de novembro de 2026/i}));
 expect(change).toHaveBeenCalledWith('2026-11-02');
});

it('mês usa nomes portugueses, permite outro ano e limpeza opcional',async()=>{
 function Example(){const [value,setValue]=useState('2026-11');return <MonthField aria-label="Filtrar mês" value={value} onValueChange={setValue} clearable min="1900-01" max="9999-12"/>;}
 render(<Example/>);
 const trigger=screen.getByRole('button',{name:'Filtrar mês'});
 expect(trigger).toHaveTextContent('Novembro de 2026');
 fireEvent.click(trigger);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Novembro'})).toHaveFocus());
 fireEvent.keyDown(screen.getByRole('button',{name:'Novembro'}),{key:'ArrowLeft'});
 expect(screen.getByRole('button',{name:'Outubro'})).toHaveFocus();
 fireEvent.change(screen.getByRole('spinbutton',{name:'Ano'}),{target:{value:'2027'}});
 fireEvent.click(screen.getByRole('button',{name:'Fevereiro'}));
 expect(trigger).toHaveTextContent('Fevereiro de 2027');
 fireEvent.click(trigger);fireEvent.click(screen.getByRole('button',{name:'Limpar período'}));
 expect(trigger).toHaveTextContent('Todos os meses');
});
it('datas digitadas respeitam limites e ano bissexto',()=>{
 const change=vi.fn();render(<DateField aria-label="Data" value="2026-11-01" onValueChange={change} min="1900-01-01" max="9990-12-31"/>);
 const input=screen.getByRole('textbox',{name:'Data'});
 for(const value of ['31/12/1899','01/01/9991','29/02/2026']){fireEvent.change(input,{target:{value}});expect(change).toHaveBeenLastCalledWith('');}
 fireEvent.change(input,{target:{value:'29/02/2024'}});expect(change).toHaveBeenLastCalledWith('2024-02-29');
});
it('teclado numérico do celular permite digitar a data sem barras',()=>{
 const change=vi.fn();render(<DateField aria-label="Data" value="2026-11-01" onValueChange={change}/>);
 const input=screen.getByRole('textbox',{name:'Data'});
 fireEvent.change(input,{target:{value:'29022024'}});
 expect(input).toHaveValue('29/02/2024');expect(change).toHaveBeenLastCalledWith('2024-02-29');
});
it('ano inválido no calendário bloqueia seleção de dias até a correção',async()=>{
 const change=vi.fn();render(<DateField aria-label="Data" value="2026-11-01" onValueChange={change}/>);
 fireEvent.click(screen.getByRole('button',{name:'Abrir calendário: Data'}));
 fireEvent.change(screen.getByRole('spinbutton',{name:'Ano do calendário'}),{target:{value:'1899'}});
 expect(screen.getByRole('button',{name:/segunda-feira, 2 de novembro de 2026/i})).toBeDisabled();
 expect(screen.getByText(/Informe um ano entre/)).toBeInTheDocument();
 fireEvent.change(screen.getByRole('spinbutton',{name:'Ano do calendário'}),{target:{value:'2026'}});
 fireEvent.click(screen.getByRole('button',{name:/segunda-feira, 2 de novembro de 2026/i}));
 expect(change).toHaveBeenCalledWith('2026-11-02');
});
it('mês não permite selecionar um ano fracionário',()=>{
 const change=vi.fn();render(<MonthField aria-label="Mês" value="2026-11" onValueChange={change}/>);
 fireEvent.click(screen.getByRole('button',{name:'Mês'}));
 fireEvent.change(screen.getByRole('spinbutton',{name:'Ano'}),{target:{value:'2026.5'}});
 expect(screen.getByRole('button',{name:'Fevereiro'})).toBeDisabled();expect(change).not.toHaveBeenCalled();
});
