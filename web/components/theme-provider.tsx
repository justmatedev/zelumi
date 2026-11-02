'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
type Theme='light'|'dark'|'system';
const Context=createContext<{theme:Theme;setTheme:(v:Theme)=>void}>({theme:'system',setTheme:()=>{}});
export function ThemeProvider({children}:{children:ReactNode}) {
 const [theme,setTheme]=useState<Theme>('system'),[ready,setReady]=useState(false);
 useEffect(()=>{try{const saved=localStorage.getItem('zelumi-color-mode');if(saved==='light'||saved==='dark'||saved==='system')setTheme(saved);}catch{}setReady(true);},[]);
 useEffect(()=>{
  if(!ready)return;
  const media=matchMedia('(prefers-color-scheme: dark)');
  const apply=()=>{document.documentElement.dataset.theme=theme==='system'?(media.matches?'dark':'light'):theme;};
  apply();try{localStorage.setItem('zelumi-color-mode',theme);}catch{}
  media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);
 },[theme,ready]);
 return <Context.Provider value={{theme,setTheme}}>{children}</Context.Provider>;
}
export const useTheme=()=>useContext(Context);
