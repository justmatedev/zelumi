'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useSession} from '@/components/session-provider';
import {api,ApiError} from '@/lib/api';
export function useFinance<T>(path:string|null){
 const {status,csrfToken,expire}=useSession(),[revision,setRevision]=useState(0),sequence=useRef(0);
 const [state,setState]=useState<{key:string;data:T|null;error:ApiError|null;loading:boolean}>({key:'',data:null,error:null,loading:true});
 const key=status==='authenticated'&&path?`${csrfToken}:${path}`:'';
 const refresh=useCallback(()=>setRevision(v=>v+1),[]);
 useEffect(()=>{
  const id=++sequence.current,controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  if(!key||!path){setState({key,data:null,error:null,loading:false});return;}
  setState(previous=>({key,data:previous.key===key?previous.data:null,error:null,loading:true}));
  async function load(attempt=0){try{const data=await api<T>(path!,{signal:controller.signal});if(id===sequence.current)setState({key,data,error:null,loading:false});}
   catch(e){if(controller.signal.aborted||id!==sequence.current)return;const error=e instanceof ApiError?e:new ApiError(0,'Confira sua conexão e tente novamente.');
    if(error.status===401){setState({key,data:null,error,loading:false});expire();return;}
    if(error.code==='HISTORY_PREPARING'&&attempt<10){setState({key,data:null,error,loading:true});timer=setTimeout(()=>void load(attempt+1),1000);return;}
    setState({key,data:null,error,loading:false});}}
  void load();const focus=()=>refresh();window.addEventListener('focus',focus);
  return()=>{++sequence.current;controller.abort();clearTimeout(timer);window.removeEventListener('focus',focus);};
 },[key,path,revision,expire,refresh]);
 return {data:state.key===key?state.data:null,error:state.key===key?state.error:null,loading:!!key&&(state.key!==key||state.loading),refresh};
}
