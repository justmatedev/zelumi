import {timingSafeEqual} from 'node:crypto';

const encoder=new TextEncoder();
export const hex=bytes=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
export const randomToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export const hashToken=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
export async function hmac(message,keyBytes) {
 const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(message)));
}
export const deriveCsrf=(token,secret,purpose)=>hmac(`zelumi:${purpose}\n${token}`,encoder.encode(secret));
export function constantTimeEqual(a,b) {
 if(typeof a!=='string'||typeof b!=='string')return false;
 const x=encoder.encode(a),y=encoder.encode(b);
 return x.length===y.length&&timingSafeEqual(x,y);
}
