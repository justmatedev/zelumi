'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {api,ApiError} from '@/lib/api';
type User={firstName:string;lastName:string|null;username:string|null};
type Status='loading'|'authenticated'|'anonymous'|'error';
type Session={user:User|null;csrfToken:string|null;status:Status;refresh:()=>Promise<void>;logout:()=>Promise<void>};
const Context=createContext<Session|null>(null);
export function SessionProvider({children}:{children:ReactNode}) {
 const [state,setState]=useState<{user:User|null;csrfToken:string|null;status:Status}>({user:null,csrfToken:null,status:'loading'});
 const sequence=useRef(0);
 const refresh=useCallback(async()=>{
  const id=++sequence.current;
  try{const data=await api<{user:User;csrfToken:string}>('/api/session');if(sequence.current===id)setState({...data,status:'authenticated'});}
  catch(error){if(sequence.current===id)setState({user:null,csrfToken:null,status:error instanceof ApiError&&error.status===401?'anonymous':'error'});}
 },[]);
 const logout=useCallback(async()=>{
  ++sequence.current;
  try{await api('/api/session/logout',{body:{},csrf:state.csrfToken||''});}
  catch(error){if(!(error instanceof ApiError&&error.status===401))throw error;}
  ++sequence.current;
  setState({user:null,csrfToken:null,status:'anonymous'});
 },[state.csrfToken]);
 useEffect(()=>{void refresh();const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>{++sequence.current;window.removeEventListener('focus',focus);};},[refresh]);
 return <Context.Provider value={{...state,refresh,logout}}>{children}</Context.Provider>;
}
export function useSession(){const value=useContext(Context);if(!value)throw new Error('SessionProvider ausente');return value;}
