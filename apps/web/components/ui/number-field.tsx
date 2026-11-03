'use client';
import {Minus,Plus} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
import {Input} from './input';
import {IconButton} from './icon-button';

export function NumberField({value,onValueChange,min,max,id,disabled,required,...aria}:{value:number;onValueChange:(value:number)=>void;min:number;max:number;id?:string;disabled?:boolean;required?:boolean;'aria-label':string}){
 const label=aria['aria-label'];
 const [text,setText]=useState(String(value||'')),emitted=useRef(value);
 useEffect(()=>{if(value!==emitted.current){setText(String(value||''));emitted.current=value;}},[value]);
 function change(next:number){setText(String(next||''));emitted.current=next;onValueChange(next);}
 return <div className="zelumi-number">
  <IconButton aria-label={`Diminuir ${label}`} disabled={disabled||value<=min} onClick={()=>change(Math.min(max,Math.max(min,value-1)))}><Minus size={16}/></IconButton>
  <Input id={id} type="number" inputMode="numeric" value={text} min={min} max={max} aria-invalid={value<min||value>max||!Number.isInteger(value)||undefined} required={required} disabled={disabled} onChange={event=>{setText(event.target.value);emitted.current=Number(event.target.value);onValueChange(emitted.current);}} {...aria}/>
  <IconButton aria-label={`Aumentar ${label}`} disabled={disabled||value>=max} onClick={()=>change(Math.max(min,Math.min(max,value+1)))}><Plus size={16}/></IconButton>
 </div>;
}
