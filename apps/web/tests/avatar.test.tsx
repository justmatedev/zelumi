import {it,expect} from 'vitest';
import {render,fireEvent} from '@testing-library/react';
import {UserAvatar} from '@/components/user-avatar';
it('usa inicial, trata erro e tenta novamente quando muda a foto',()=>{
 const {container,rerender}=render(<UserAvatar firstName="João" photoUrl={null}/>);
 expect(container.textContent).toBe('J');
 rerender(<UserAvatar firstName="João" photoUrl="https://example.com/a.jpg"/>);
 const image=container.querySelector('img')!;expect(image).toHaveAttribute('referrerpolicy','no-referrer');
 fireEvent.error(image);expect(container.querySelector('img')).toBeNull();expect(container.textContent).toBe('J');
 rerender(<UserAvatar firstName="João" photoUrl="https://example.com/b.jpg"/>);
 expect(container.querySelector('img')).toHaveAttribute('src','https://example.com/b.jpg');
});
