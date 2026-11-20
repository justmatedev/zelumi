'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useSession} from '@/features/auth/providers/session-provider';
import {api,ApiError} from '@/lib/api';
type Options={cache?:boolean;prefetch?:string[]};
const cacheLifetime=30_000,cacheLimit=12;
export function useFinance<T>(path:string|null,options:Options={}){
 const {status,csrfToken,expire}=useSession(),[revision,setRevision]=useState(0),sequence=useRef(0);
 // Private to this mounted consumer: never persist financial data across accounts or pages.
 const cache=useRef(new Map<string,{data:T;expires:number}>()),generation=useRef(0);
 const enabled=options.cache===true,prefetchPaths=JSON.stringify(options.prefetch||[]);
 const [state,setState]=useState<{key:string;data:T|null;error:ApiError|null;loading:boolean}>({key:'',data:null,error:null,loading:true});
 const scope=status==='authenticated'?csrfToken:null,key=scope&&path?`${scope}:${path}`:'';
 const refresh=useCallback(()=>{cache.current.clear();++generation.current;setRevision(v=>v+1);},[]);
 useEffect(()=>{cache.current.clear();++generation.current;},[scope]);
 function remember(cacheKey:string,data:T){
  cache.current.delete(cacheKey);cache.current.set(cacheKey,{data,expires:Date.now()+cacheLifetime});
  if(cache.current.size>cacheLimit)cache.current.delete(cache.current.keys().next().value!);
 }
 useEffect(()=>{
  const id=++sequence.current,controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  if(!key||!path){setState({key,data:null,error:null,loading:false});return;}
  const stored=enabled?cache.current.get(key):undefined;
  if(stored&&stored.expires>Date.now()){setState({key,data:stored.data,error:null,loading:false});return;}
  setState(previous=>({key,data:previous.key===key?previous.data:null,error:null,loading:true}));
  async function load(attempt=0){try{const data=await api<T>(path!,{signal:controller.signal});if(!controller.signal.aborted&&id===sequence.current){if(enabled)remember(key,data);setState({key,data,error:null,loading:false});}}
   catch(e){if(controller.signal.aborted||id!==sequence.current)return;const error=e instanceof ApiError?e:new ApiError(0,'Confira sua conexão e tente novamente.');
    if(error.status===401){cache.current.clear();setState({key,data:null,error,loading:false});expire();return;}
    if(error.code==='HISTORY_PREPARING'&&attempt<10){setState({key,data:null,error,loading:true});timer=setTimeout(()=>void load(attempt+1),1000);return;}
    setState({key,data:null,error,loading:false});}}
  void load();
  return()=>{++sequence.current;controller.abort();clearTimeout(timer);};
 },[key,path,revision,expire,enabled]);
 useEffect(()=>{if(!key)return;window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[key,refresh]);
 useEffect(()=>{
  if(!enabled||!scope||!path||state.key!==key||!state.data||state.loading||state.error)return;
  const controller=new AbortController(),version=generation.current;
  for(const nextPath of JSON.parse(prefetchPaths) as string[]){
   const nextKey=`${scope}:${nextPath}`,stored=cache.current.get(nextKey);
   if(nextPath===path||stored&&stored.expires>Date.now())continue;
   void api<T>(nextPath,{signal:controller.signal}).then(data=>{
    if(!controller.signal.aborted&&version===generation.current)remember(nextKey,data);
   }).catch(error=>{
    if(!controller.signal.aborted&&version===generation.current&&error instanceof ApiError&&error.status===401){cache.current.clear();expire();}
   });
  }
  return()=>controller.abort();
 },[enabled,scope,path,key,state,prefetchPaths,revision,expire]);
 const stored=enabled&&key?cache.current.get(key):undefined,cached=stored&&stored.expires>Date.now()?stored.data:null;
 return {data:state.key===key?state.data:cached,error:state.key===key?state.error:null,loading:!!key&&(state.key!==key?!cached:state.loading),refresh};
}
