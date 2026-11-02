'use client';
import {useId} from 'react';
import {Check} from 'lucide-react';
import type {SelectOption} from './select';

export function SegmentedControl({value,onValueChange,options,disabled,id,...aria}:{value:string;onValueChange:(value:string)=>void;options:SelectOption[];disabled?:boolean;id?:string;'aria-label'?:string;'aria-labelledby'?:string}){
 const name=useId();
 return <div className="zelumi-segmented" role="radiogroup" id={id} {...aria}>{options.map(option=><label key={option.value} className="zelumi-segment">
  <input type="radio" name={name} value={option.value} checked={value===option.value} disabled={disabled||option.disabled} onChange={()=>onValueChange(option.value)}/>
  <span>{option.label}{value===option.value&&<Check size={15} aria-hidden="true"/>}</span>
 </label>)}</div>;
}
