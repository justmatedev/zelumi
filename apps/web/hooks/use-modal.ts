'use client';
import {useEffect,useRef,type PointerEvent,type MouseEvent} from 'react';

let locks=0,restore:(()=>void)|undefined;

// Keep a single snapshot so overlapping dialogs cannot unlock one another.
function lockPage(){
 if(locks++===0){
  const root=document.documentElement,body=document.body;
  const x=window.scrollX,y=window.scrollY;
  const previous={overflow:body.style.overflow,position:body.style.position,top:body.style.top,left:body.style.left,width:body.style.width,paddingRight:body.style.paddingRight};
  const rootOverflow=root.style.overflow;
  const gutter=Math.max(0,window.innerWidth-root.clientWidth);
  const padding=parseFloat(getComputedStyle(body).paddingRight)||0;
  root.style.overflow='hidden';
  Object.assign(body.style,{overflow:'hidden',position:'fixed',top:`-${y}px`,left:`-${x}px`,width:'100%',paddingRight:`${padding+gutter}px`});
  restore=()=>{Object.assign(body.style,previous);root.style.overflow=rootOverflow;window.scrollTo({left:x,top:y,behavior:'instant'});};
 }
 let released=false;
 return()=>{if(released)return;released=true;if(--locks===0){restore?.();restore=undefined;}};
}

export function useModalScrollLock(active:boolean){
 useEffect(()=>{if(active)return lockPage();},[active]);
}

function isBackdrop(event:PointerEvent<HTMLDialogElement>|MouseEvent<HTMLDialogElement>){
 if(event.target!==event.currentTarget)return false;
 const {left,right,top,bottom}=event.currentTarget.getBoundingClientRect();
 return event.clientX<left||event.clientX>right||event.clientY<top||event.clientY>bottom;
}

export function useDialogBackdrop(onDismiss:()=>void,disabled=false){
 const startedOutside=useRef(false);
 return {
  onPointerDown(event:PointerEvent<HTMLDialogElement>){startedOutside.current=isBackdrop(event);},
  onClick(event:MouseEvent<HTMLDialogElement>){
   const dismiss=startedOutside.current&&isBackdrop(event);
   startedOutside.current=false;
   if(dismiss&&!disabled)onDismiss();
  },
 };
}
