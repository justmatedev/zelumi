'use client';
import {useRef,useState,type ReactNode} from 'react';
import * as Primitive from '@radix-ui/react-popover';
import {cn} from '@/lib/utils';

export function ControlPopover({trigger,children,label,open,onOpenChange,className}:{trigger:ReactNode;children:ReactNode;label:string;open:boolean;onOpenChange:(open:boolean)=>void;className?:string}){
 const ref=useRef<HTMLSpanElement>(null),content=useRef<HTMLDivElement>(null),[container,setContainer]=useState<HTMLElement|undefined>();
 return <Primitive.Root open={open} onOpenChange={next=>{if(next)setContainer(ref.current?.closest('dialog')||undefined);onOpenChange(next);}}>
  <span ref={ref} className="zelumi-popover-anchor"><Primitive.Trigger asChild>{trigger}</Primitive.Trigger></span>
  <Primitive.Portal container={container}><Primitive.Content ref={content} aria-label={label} className={cn('zelumi-popover',className)} align="start" sideOffset={6} collisionPadding={4} onEscapeKeyDown={event=>event.stopPropagation()}
   onOpenAutoFocus={event=>{const initial=content.current?.querySelector<HTMLElement>('[data-initial-focus]');if(initial){event.preventDefault();initial.focus();}}}>
   {children}
  </Primitive.Content></Primitive.Portal>
 </Primitive.Root>;
}
