'use client';
import {useEffect,useRef,useState} from 'react';
import {CalendarDays,Check} from 'lucide-react';
import {DayPicker} from 'react-day-picker';
import {ptBR} from 'react-day-picker/locale';
import {Input} from './input';
import {IconButton} from './icon-button';
import {NumberField} from './number-field';
import {Select} from './select';
import {ControlPopover} from './control-popover';
import {Button} from './button';

const months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const pad=(value:number)=>String(value).padStart(2,'0');
const iso=(date:Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
function fromISO(value:string){
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);if(!match)return undefined;
 const date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),12);
 return iso(date)===value?date:undefined;
}
const display=(value:string)=>value?value.split('-').reverse().join('/'):'';
type Common={value:string;onValueChange:(value:string)=>void;id?:string;min?:string;max?:string;disabled?:boolean;required?:boolean;'aria-label':string;'aria-describedby'?:string};

export function DateField({value,onValueChange,id,min='1900-01-01',max='9990-12-31',disabled,required,...aria}:Common){
 const [text,setText]=useState(()=>display(value)),[open,setOpen]=useState(false),[month,setMonth]=useState(()=>fromISO(value)||new Date());
 const [calendarYear,setCalendarYear]=useState(month.getFullYear());
 const emitted=useRef(value),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(value!==emitted.current){setText(display(value));emitted.current=value;}},[value]);
 const valid=fromISO(text.split('/').reverse().join('-'));
 const invalid=!!text&&(!/^\d{2}\/\d{2}\/\d{4}$/.test(text)||!valid||iso(valid)<min||iso(valid)>max);
 const first=fromISO(min)!,last=fromISO(max)!;
 const invalidYear=calendarYear<first.getFullYear()||calendarYear>last.getFullYear()||!Number.isInteger(calendarYear);
 function commit(next:string){emitted.current=next;onValueChange(next);}
 function change(text:string){
  if(/^[\d/]*$/.test(text)){const digits=text.replaceAll('/','').slice(0,8);text=digits.slice(0,2)+(digits.length>2?'/'+digits.slice(2,4):'')+(digits.length>4?'/'+digits.slice(4):'');}
  setText(text);const candidate=text.split('/').reverse().join('-'),date=fromISO(candidate);commit(date&&candidate>=min&&candidate<=max?candidate:'');
 }
 return <div className="zelumi-date-field">
  <Input id={id} ref={input} aria-invalid={invalid||undefined} {...aria} disabled={disabled} required={required} inputMode="numeric" placeholder="dd/mm/aaaa" maxLength={10}
   value={text} pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" onChange={event=>change(event.target.value)}
   onBlur={()=>input.current?.setCustomValidity(invalid?'Informe uma data válida dentro do período permitido.':'')}
   onInput={event=>event.currentTarget.setCustomValidity('')}/>
  <ControlPopover open={open} onOpenChange={next=>{if(next){const selected=fromISO(value)||first;setMonth(selected);setCalendarYear(selected.getFullYear());}setOpen(next);}} label={`Escolher ${aria['aria-label']}`} className="zelumi-calendar-popover"
   trigger={<IconButton aria-label={`Abrir calendário: ${aria['aria-label']}`} disabled={disabled}><CalendarDays size={18}/></IconButton>}>
   <div className="zelumi-calendar-toolbar">
    <Select aria-label="Mês do calendário" value={String(month.getMonth())} onValueChange={m=>setMonth(new Date(month.getFullYear(),Number(m),1,12))} options={months.map((label,i)=>({value:String(i),label}))}/>
    <NumberField aria-label="Ano do calendário" value={calendarYear} min={first.getFullYear()} max={last.getFullYear()} onValueChange={year=>{setCalendarYear(year);if(Number.isInteger(year)&&year>=first.getFullYear()&&year<=last.getFullYear())setMonth(new Date(year,month.getMonth(),1,12));}}/>
   </div>
   <DayPicker mode="single" locale={ptBR} month={month} onMonthChange={date=>{setMonth(date);setCalendarYear(date.getFullYear());}} selected={fromISO(value)} startMonth={first} endMonth={last} disabled={invalidYear?true:[{before:first},{after:last}]} autoFocus showOutsideDays fixedWeeks
    labels={{labelNext:()=> 'Próximo mês',labelPrevious:()=> 'Mês anterior'}}
    onSelect={date=>{if(date){const next=iso(date);setText(display(next));commit(next);input.current?.setCustomValidity('');setOpen(false);}}}/>
   <p className="zelumi-calendar-hint" role={invalidYear?'alert':undefined}>{invalidYear?`Informe um ano entre ${first.getFullYear()} e ${last.getFullYear()}.`:'Use as setas para navegar entre os dias.'}</p>
  </ControlPopover>
 </div>;
}

export function MonthField({value,onValueChange,id,min='1900-01',max='9999-12',disabled,clearable=false,placeholder='Todos os meses',className,...aria}:Omit<Common,'required'>&{clearable?:boolean;placeholder?:string;className?:string}){
 const [open,setOpen]=useState(false),[year,setYear]=useState(()=>Number(value.slice(0,4))||new Date().getFullYear());
 const minYear=Number(min.slice(0,4)),maxYear=Number(max.slice(0,4));
 const label=value?`${months[Number(value.slice(5,7))-1]} de ${value.slice(0,4)}`:placeholder;
 const choose=(next:string)=>{if(next&&(!Number.isInteger(year)||year<minYear||year>maxYear||next<min||next>max))return;onValueChange(next);setOpen(false);};
 return <ControlPopover open={open} onOpenChange={next=>{if(next)setYear(Number(value.slice(0,4))||new Date().getFullYear());setOpen(next);}} label={`Escolher ${aria['aria-label']}`} className="zelumi-month-popover"
  trigger={<button id={id} type="button" className={`zelumi-input zelumi-month-trigger ${className||''}`} disabled={disabled} {...aria}><span>{label}</span><CalendarDays size={18} aria-hidden="true"/></button>}>
  <div className="zelumi-month-heading"><span>Escolha o mês</span><NumberField aria-label="Ano" min={minYear} max={maxYear} value={year} onValueChange={setYear}/></div>
  <div className="zelumi-month-grid" onKeyDown={event=>{
   const steps:Record<string,number>={ArrowRight:1,ArrowLeft:-1,ArrowDown:3,ArrowUp:-3};
   if(!(event.key in steps)&&event.key!=='Home'&&event.key!=='End')return;
   const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
   const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
   let next=event.key==='Home'?0:event.key==='End'?11:Math.max(0,Math.min(11,index+steps[event.key]));
   const direction=event.key==='Home'?1:event.key==='End'?-1:Math.sign(steps[event.key]);
   while(buttons[next]?.disabled&&next>=0&&next<12)next+=direction;
   event.preventDefault();buttons[next]?.focus();
  }}>{months.map((month,i)=>{const next=`${year}-${pad(i+1)}`,initial=value?value===next:i===new Date().getMonth();return <button key={month} type="button" data-initial-focus={initial?'':undefined} disabled={!Number.isInteger(year)||year<minYear||year>maxYear||next<min||next>max} aria-pressed={value===next} onClick={()=>choose(next)}>{month}{value===next&&<Check size={14} aria-hidden="true"/>}</button>;})}</div>
  {clearable&&<Button type="button" variant="ghost" className="zelumi-month-clear" onClick={()=>choose('')}>Limpar período</Button>}
 </ControlPopover>;
}
