export class ApiError extends Error {
 constructor(public status:number,message:string){super(message);}
}
export async function api<T>(path:string,options:{body?:unknown;csrf?:string;signal?:AbortSignal}={}):Promise<T> {
 const response=await fetch(path,{method:options.body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:options.signal,
  headers:{...(options.body===undefined?{}:{'Content-Type':'application/json'}),...(options.csrf?{'X-CSRF-Token':options.csrf}:{})},
  ...(options.body===undefined?{}:{body:JSON.stringify(options.body)})});
 if(!response.ok){const data=await response.json().catch(()=>null);throw new ApiError(response.status,data?.error||'Não foi possível conectar. Tente novamente.');}
 return response.json();
}
