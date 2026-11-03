import type {ComponentProps} from 'react';
import {Button} from './button';
import {cn} from '@/lib/utils';

export function IconButton({className,type='button',...props}:ComponentProps<'button'>&{'aria-label':string}){
 return <Button type={type} variant="ghost" className={cn('zelumi-icon-button',className)} {...props}/>;
}
