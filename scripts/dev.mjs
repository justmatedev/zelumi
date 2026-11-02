import {spawn} from 'node:child_process';
import {existsSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {seedDemo,LOCAL_ORIGIN} from '../dev/demo.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const config=resolve(root,'dev/wrangler.jsonc'),persist=resolve(root,'.wrangler/local-dev');
const wrangler=resolve(root,'node_modules/wrangler/bin/wrangler.js');
const next=resolve(root,'web/node_modules/next/dist/bin/next');
const children=new Set();let stopping=false;
// Empty explicit env file prevents Wrangler from loading the project's credentials.
const env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:resolve(root,'.wrangler/logs'),NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'development',ZELUMI_LOCAL_DEV:'1',NEXT_PUBLIC_LOCAL_DEV:'1'};
for(const key of Object.keys(env))if(/^(TELEGRAM_|CLOUDFLARE_|CF_|VERCEL_|APP_ORIGIN$)/.test(key))delete env[key];
const envFile=resolve(root,'dev/local.env');
function stop(code=0){
 if(stopping)return;stopping=true;process.exitCode=code;
 for(const child of children){try{if(process.platform==='win32')child.kill();else process.kill(-child.pid,'SIGTERM');}catch{}}
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
function run(executable,args,{cwd=root,service=false}={}){
 return new Promise((yes,no)=>{
  const child=spawn(executable,args,{cwd,env,stdio:[service?'inherit':'ignore','inherit','inherit'],detached:process.platform!=='win32'});children.add(child);
  child.once('error',error=>{children.delete(child);no(error);});
  child.once('exit',code=>{if(service&&!stopping){if(code===0)console.log('Ambiente local encerrado.');else console.error('Um dos servidores foi encerrado.');stop(code??1);}children.delete(child);if(code===0||stopping)yes();else no(new Error(`Comando falhou (código ${code}): ${executable}`));});
 });
}
async function available(port,host){
 await new Promise((yes,no)=>{const server=createServer();server.once('error',()=>no(new Error(`A porta ${port} está em uso. Encerre o servidor anterior e execute npm run dev novamente.`)));server.listen(port,host,()=>server.close(yes));});
}
async function main(){
 if(!existsSync(wrangler)||!existsSync(next))throw new Error('Instale as dependências: npm ci && npm --prefix web ci');
 await available(3000,'localhost');await available(8788,'127.0.0.1');
 console.log('Preparando banco local e conta de teste…');
 await run(process.execPath,[wrangler,'d1','migrations','apply','DB','--local','--config',config,'--persist-to',persist,'--env-file',envFile]);
 if(stopping)return;
 process.env.WRANGLER_LOG_PATH=env.WRANGLER_LOG_PATH;process.env.WRANGLER_SEND_METRICS='false';
 const {getPlatformProxy}=await import('wrangler');
 const platform=await getPlatformProxy({configPath:config,persist:{path:resolve(persist,'v3')},remoteBindings:false,envFiles:[envFile]});
 try{await seedDemo(platform.env.DB);}finally{await platform.dispose();}
 if(stopping)return;
 const certDir=resolve(persist,'certs'),key=resolve(certDir,'localhost-key.pem'),cert=resolve(certDir,'localhost.pem');
 if(!existsSync(key)||!existsSync(cert)){
  mkdirSync(certDir,{recursive:true});
  await run('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','365','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1']);
 }
 if(stopping)return;
 const api=run(process.execPath,[wrangler,'dev','--local','--config',config,'--persist-to',persist,'--env-file',envFile,'--ip','127.0.0.1','--port','8788'],{service:true});
 // Attach rejection handlers immediately while waiting for readiness.
 api.catch(error=>{console.error(error.message);stop(1);});
 let ready=false;
 for(let i=0;i<100&&!stopping;i++){
  try{const response=await fetch('http://127.0.0.1:8788/health',{signal:AbortSignal.timeout(500)});if(response.ok){ready=true;break;}}catch{}
  await delay(200);
 }
 if(stopping)return;
 if(!ready)throw new Error('A API local não iniciou. Confira as mensagens acima.');
 console.log(`\nZelumi local: ${LOCAL_ORIGIN}\nUse “Entrar com conta de teste”. Os dados são fictícios e persistem entre reinícios.\nAceite o certificado local no navegador. Ctrl+C encerra os dois servidores.\n`);
 await Promise.all([api,run(process.execPath,[next,'dev','--hostname','localhost','--port','3000','--experimental-https','--experimental-https-key',key,'--experimental-https-cert',cert],{cwd:resolve(root,'web'),service:true})]);
}
main().catch(error=>{console.error(error.message);stop(1);});
