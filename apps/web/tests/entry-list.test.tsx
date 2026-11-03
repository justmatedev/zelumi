import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent,within} from '@testing-library/react';
import {EntryList} from '@/features/finance/components/entry-list';
import type {Entry} from '@/features/finance/lib/finance';
const expense:Entry={recordId:'42',description:'Notebook de exemplo',type:'despesa',category:'Outros',date:'2026-11-01',month:'2026-11',installment:1,installments:6,amount:20000,totalAmount:120000};
it('mostra parcela por extenso e abre o registro correspondente',()=>{
 const open=vi.fn();render(<EntryList items={[expense]} onOpen={open}/>);
 const row=screen.getByRole('button',{name:/Notebook de exemplo/});
 expect(within(row).getByText('Parcela 1 de 6')).toBeInTheDocument();
 expect(within(row).getByText(/− R\$\s*200,00/)).toBeInTheDocument();
 fireEvent.click(row);expect(open).toHaveBeenCalledWith('42');
});
it('distingue receita à vista de despesa parcelada sem perder descrição longa',()=>{
 const description='Pagamento de um trabalho com uma descrição longa e completa';
 render(<EntryList items={[{...expense,recordId:'43',description,type:'receita',category:'Receitas',installment:1,installments:1,amount:650000,totalAmount:650000}]} onOpen={()=>{}}/>);
 const row=screen.getByRole('button',{name:new RegExp(description)});
 expect(within(row).getByText(description)).toBeInTheDocument();
 expect(within(row).getByText('À vista')).toBeInTheDocument();
 expect(within(row).getByText(/\+ R\$\s*6\.500,00/)).toBeInTheDocument();
 expect(within(row).queryByText(/Parcela/)).not.toBeInTheDocument();
});
it('permite orientar o estado vazio conforme a tela sem sugerir filtros inexistentes',()=>{
 render(<EntryList items={[]} onOpen={()=>{}} emptyMessage="Os lançamentos deste mês aparecerão aqui."/>);
 expect(screen.getByText('Os lançamentos deste mês aparecerão aqui.')).toBeInTheDocument();
 expect(screen.queryByText(/amplie os filtros/)).not.toBeInTheDocument();
});
