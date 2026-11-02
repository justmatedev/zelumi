export class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
export function json(data,status=200,extra={}) {
 return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",...extra}});
}
export function cookie(request,name) {
 const values=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='));
 if(values.length!==1)return null;
 const value=values[0].slice(name.length+1);return /^[a-f0-9]{64}$/.test(value)?value:null;
}
export const setCookie=(name,value,seconds)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
export function config(env) {
 const origin=new URL(env.APP_ORIGIN);
 if(origin.origin!==env.APP_ORIGIN||origin.protocol!=='https:'||! /^\w{5,32}$/.test(env.TELEGRAM_BOT_USERNAME||'')||! /^\d+:[A-Za-z0-9_-]+$/.test(env.TELEGRAM_BOT_TOKEN||'')||!env.DB)throw new Error('Invalid configuration');
 return origin.origin;
}
export async function body(request) {
 if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new HttpError(400,'Envie JSON.');
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Corpo inválido.');
 const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();throw new HttpError(413,'Corpo muito grande.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const value of chunks){bytes.set(value,offset);offset+=value.length;}
 let data;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new HttpError(400,'JSON inválido.');}
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpError(400,'Corpo inválido.');
 return data;
}
