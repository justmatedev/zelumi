import {constantTimeEqual,hashToken,hmac} from './crypto.mjs';

export class InvalidTelegramPayload extends Error {
 constructor(){super('Autorização Telegram inválida ou expirada.');this.name='InvalidTelegramPayload';}
}
const allowed=new Set(['id','first_name','last_name','username','photo_url','auth_date','hash']);
function positiveInteger(value) {
 if(typeof value==='number')return Number.isSafeInteger(value)&&value>0?String(value):null;
 if(typeof value!=='string'||! /^[1-9]\d{0,15}$/.test(value))return null;
 return Number.isSafeInteger(Number(value))?value:null;
}
export async function verifyTelegramPayload(payload,{botToken,nowMs}) {
 const invalid=()=>{throw new InvalidTelegramPayload();};
 if(!payload||typeof payload!=='object'||Array.isArray(payload))invalid();
 if(Object.keys(payload).some(k=>!allowed.has(k)))invalid();
 const owner=positiveInteger(payload.id),date=positiveInteger(payload.auth_date);
 if(!owner||!date||typeof payload.first_name!=='string'||!payload.first_name||payload.first_name.length>512)invalid();
 if(typeof payload.hash!=='string'||! /^[a-f0-9]{64}$/.test(payload.hash))invalid();
 for(const key of ['last_name','username','photo_url'])if(key in payload&&(typeof payload[key]!=='string'||payload[key].length>4096))invalid();
 const age=Math.floor(nowMs/1000)-Number(date);
 if(age>300||age< -30)invalid();
 const check=Object.keys(payload).filter(k=>k!=='hash').sort().map(k=>`${k}=${payload[k]}`).join('\n');
 const key=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(botToken));
 if(!constantTimeEqual(await hmac(check,key),payload.hash))invalid();
 return {owner,firstName:payload.first_name,lastName:payload.last_name??null,username:payload.username??null,payloadHash:await hashToken(payload.hash)};
}
