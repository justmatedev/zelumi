import {it,expect,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import {SessionProvider} from '@/features/auth/providers/session-provider';
import {Profile} from '@/features/profile/components/profile';
it('renderiza nome como texto e suporta conta sem username',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({user:{firstName:'<img src=x onerror=alert(1)>',lastName:null,username:null},csrfToken:'csrf'}))));
 const {container}=render(<SessionProvider><Profile/></SessionProvider>);await screen.findByText('Não informado');expect(container.querySelector('img')).toBeNull();
 expect(screen.getByRole('button',{name:'Sair da conta'})).toBeEnabled();
});
