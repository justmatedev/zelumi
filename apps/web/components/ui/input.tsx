import type {ComponentProps} from 'react';
import {cn} from '@/lib/utils';

export function Input({className,...props}:ComponentProps<'input'>){
 return <input className={cn('zelumi-input',className)} {...props}/>;
}

export function Field({label,id,children,hint}:{label:string;id:string;children:React.ReactNode;hint?:string}){
 return <div className="zelumi-field"><label id={`${id}-label`} htmlFor={id}>{label}</label>{children}{hint&&<small id={`${id}-hint`}>{hint}</small>}</div>;
}
