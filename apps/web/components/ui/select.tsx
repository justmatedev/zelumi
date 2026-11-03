'use client';
import {useRef,useState} from 'react';
import * as Primitive from '@radix-ui/react-select';
import {Check,ChevronDown,ChevronUp} from 'lucide-react';
import {cn} from '@/lib/utils';

export type SelectOption={value:string;label:string;disabled?:boolean};
type Props={value:string;onValueChange:(value:string)=>void;options:SelectOption[];id?:string;disabled?:boolean;required?:boolean;className?:string;'aria-label'?:string;'aria-labelledby'?:string;'aria-describedby'?:string;'aria-invalid'?:boolean};
const empty='__zelumi_empty__';
export function Select({value,onValueChange,options,id,disabled,required,className,...aria}:Props){
 const ref=useRef<HTMLButtonElement>(null),[container,setContainer]=useState<HTMLElement|undefined>();
 return <Primitive.Root value={value||empty} onValueChange={v=>onValueChange(v===empty?'':v)} disabled={disabled} required={required}
  onOpenChange={open=>{if(open)setContainer(ref.current?.closest('dialog')||undefined);}}>
  <Primitive.Trigger ref={ref} id={id} className={cn('zelumi-input zelumi-select',className)} {...aria}>
   <Primitive.Value/><Primitive.Icon asChild><ChevronDown size={17} aria-hidden="true"/></Primitive.Icon>
  </Primitive.Trigger>
  <Primitive.Portal container={container}><Primitive.Content className="zelumi-menu" position="popper" sideOffset={6} collisionPadding={8}
   onEscapeKeyDown={event=>event.stopPropagation()}>
   <Primitive.ScrollUpButton className="zelumi-menu-scroll"><ChevronUp size={16}/></Primitive.ScrollUpButton>
   <Primitive.Viewport className="zelumi-menu-options">{options.map(option=><Primitive.Item className="zelumi-menu-option" key={option.value} value={option.value||empty} disabled={option.disabled}>
    <Primitive.ItemText>{option.label}</Primitive.ItemText><Primitive.ItemIndicator><Check size={16} aria-hidden="true"/></Primitive.ItemIndicator>
   </Primitive.Item>)}</Primitive.Viewport>
   <Primitive.ScrollDownButton className="zelumi-menu-scroll"><ChevronDown size={16}/></Primitive.ScrollDownButton>
  </Primitive.Content></Primitive.Portal>
 </Primitive.Root>;
}
