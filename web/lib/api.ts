export class ApiError extends Error {
 constructor(public status:number,message:string,public code='',public retryAfter=0){super(message);}
}
export async function api<T>(path:string,options:{body?:unknown;csrf?:string;signal?:AbortSignal;method?:'GET'|'POST'|'PUT'|'DELETE';operationKey?:string}={}):Promise<T> {
 const response=await fetch(path,{method:options.method||(options.body===undefined?'GET':'POST'),credentials:'same-origin',cache:'no-store',signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),
  headers:{...(options.body===undefined?{}:{'Content-Type':'application/json'}),...(options.csrf?{'X-CSRF-Token':options.csrf}:{}),...(options.operationKey?{'Idempotency-Key':options.operationKey}:{})},
  ...(options.body===undefined?{}:{body:JSON.stringify(options.body)})});
 if(!response.ok){const data=await response.json().catch(()=>null);throw new ApiError(response.status,data?.error||'Não foi possível conectar. Tente novamente.',data?.code||'',Number(response.headers.get('Retry-After'))||0);}
 return response.json();
}
