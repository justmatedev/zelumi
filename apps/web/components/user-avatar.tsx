'use client';
import {useState} from 'react';
type Props={firstName:string;photoUrl?:string|null;size?:'profile'|'compact'};
function AvatarImage({firstName,photoUrl,size}:Props){
 const [failed,setFailed]=useState(false);
 const initial=Array.from(firstName)[0]?.toLocaleUpperCase('pt-BR')||'Z';
 return <span className={`avatar${size==='compact'?' avatar-compact':''}`} aria-hidden="true">{photoUrl&&!failed?<img src={photoUrl} alt="" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:initial}</span>;
}
export function UserAvatar(props:Props){return <AvatarImage key={props.photoUrl??''} {...props}/>;}
