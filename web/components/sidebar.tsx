'use client';
import {IconButton} from '@/components/ui/icon-button';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import {LayoutDashboard,ArrowLeftRight,UserRound,Send,PanelLeftClose,PanelLeftOpen,Menu,X} from 'lucide-react';
import {Brand} from '@/components/brand';
export const navigationItems=[{href:'/visao-geral/',label:'Visão geral',icon:LayoutDashboard},{href:'/lancamentos/',label:'Lançamentos',icon:ArrowLeftRight},{href:'/perfil/',label:'Perfil',icon:UserRound}];
const preferenceKey='zelumi-sidebar-collapsed';
export function useSidebarPreference(){
 const [collapsed,setCollapsed]=useState(false);
 useEffect(()=>{try{setCollapsed(localStorage.getItem(preferenceKey)==='true');}catch{}},[]);
 function toggle(){const next=!collapsed;setCollapsed(next);try{localStorage.setItem(preferenceKey,String(next));}catch{}}
 return {collapsed,toggle};
}
function NavigationContents({path,onNavigate,id}:{path:string;onNavigate?:()=>void;id?:string}){
 const [dismissed,setDismissed]=useState(false);
 const tooltip=(label:string)=>!dismissed&&<span className="sidebar-tooltip" aria-hidden="true">{label}</span>;
 return <><p className="nav-caption">SEU ESPAÇO</p><nav id={id} aria-label="Principal" onKeyDown={event=>{if(event.key==='Escape')setDismissed(true);}}>{navigationItems.map(({href,label,icon:Icon})=>{
  const active=path.replace(/\/$/,'')===href.replace(/\/$/,'');
  return <Link key={href} href={href} aria-label={label} aria-current={active?'page':undefined} className={active?'nav-item active':'nav-item'} onClick={onNavigate} onFocus={()=>setDismissed(false)} onMouseEnter={()=>setDismissed(false)}><Icon size={19} aria-hidden="true"/><span className="nav-label">{label}</span>{tooltip(label)}</Link>;
 })}</nav><div className="sidebar-note"><span className="sidebar-message">Uma mensagem.<br/>Tudo mais organizado.</span><a href="https://t.me/zelumi_bot" target="_blank" rel="noreferrer" aria-label="Abrir o Telegram" onClick={onNavigate} onFocus={()=>setDismissed(false)} onMouseEnter={()=>setDismissed(false)} onKeyDown={event=>{if(event.key==='Escape')setDismissed(true);}}><Send size={18} aria-hidden="true"/><span className="nav-label">Abrir o Telegram</span>{tooltip('Abrir o Telegram')}</a></div><span className="sidebar-foot">zelumi · no seu ritmo</span></>;
}
export function Sidebar({path,collapsed,onToggle}:{path:string;collapsed:boolean;onToggle:()=>void}){
 const label=collapsed?'Expandir barra lateral':'Recolher barra lateral';
 return <aside className="sidebar" aria-label="Barra lateral"><div className="sidebar-brand"><Brand/></div><IconButton type="button" className="sidebar-toggle" onClick={onToggle} aria-label={label} title={label} aria-expanded={!collapsed} aria-controls="sidebar-navigation">{collapsed?<PanelLeftOpen size={16} aria-hidden="true"/>:<PanelLeftClose size={16} aria-hidden="true"/>}</IconButton><NavigationContents path={path} id="sidebar-navigation"/></aside>;
}
export function MobileMenu({path}:{path:string}){
 const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLButtonElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false);
 const close=useCallback(()=>{dialog.current?.close();setOpen(false);},[]);
 useEffect(()=>{if(dialog.current?.open)close();},[path,close]);
 useEffect(()=>{
  const media=window.matchMedia('(max-width: 760px)');
  const resize=()=>{if(!media.matches&&dialog.current?.open)close();};
  media.addEventListener('change',resize);return()=>media.removeEventListener('change',resize);
 },[close]);
 useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[open]);
 function show(){dialog.current?.showModal();setOpen(true);closeButton.current?.focus();}
 return <><IconButton type="button" ref={opener} className="mobile-menu-toggle" aria-label="Abrir menu" aria-expanded={open} aria-controls="mobile-navigation" aria-haspopup="dialog" onClick={show}><Menu size={21} aria-hidden="true"/></IconButton><dialog id="mobile-navigation" ref={dialog} className="mobile-drawer" aria-label="Menu de navegação" onClose={()=>{setOpen(false);opener.current?.focus();}} onClick={event=>{if(event.target===event.currentTarget)close();}}><div className="mobile-drawer-content"><div className="mobile-drawer-heading"><Brand/><IconButton type="button" ref={closeButton} className="mobile-menu-close" aria-label="Fechar menu" onClick={close}><X size={20} aria-hidden="true"/></IconButton></div><NavigationContents path={path} onNavigate={close}/></div></dialog></>;
}
