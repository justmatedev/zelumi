import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {SessionProvider} from '@/components/session-provider';
import {Profile} from '@/components/profile';
it('renderiza nome como texto, suporta conta sem username e informa falha de logout',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({user:{firstName:'<img src=x onerror=alert(1)>',lastName:null,username:null},csrfToken:'csrf'}))).mockRejectedValueOnce(new Error('offline')));
 const {container}=render(<SessionProvider><Profile/></SessionProvider>);await screen.findByText('Não informado');expect(container.querySelector('img')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Sair da conta'}));await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Sair da conta'})).toBeEnabled();expect(screen.getByText('Não informado')).toBeInTheDocument();
});
