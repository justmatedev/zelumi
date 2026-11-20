import {spawn} from 'node:child_process';
import {cpSync,existsSync,mkdirSync,readFileSync,renameSync,rmSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const configPath=resolve(root,'apps/api/demo/wrangler.jsonc');
const config=JSON.parse(readFileSync(configPath,'utf8'));
const db=config.d1_databases[0];
const prod=JSON.parse(readFileSync(resolve(root,'apps/api/wrangler.jsonc'),'utf8'));
if(config.name===prod.name||db.database_name!=='zelumi-public-demo'||db.database_id===prod.d1_databases[0].database_id)throw new Error('A demonstração exige Worker e D1 exclusivos.');
const environment={...process.env,NEXT_TELEMETRY_DISABLED:'1',WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:resolve(root,'.wrangler/logs'),XDG_CONFIG_HOME:resolve(root,'.wrangler/auth')};
function command(executable,args,env=environment){
 return new Promise((yes,no)=>{
  const child=spawn(executable,args,{cwd:root,env,stdio:'inherit'});
  child.on('error',no);child.on('exit',code=>code===0?yes():no(new Error('Etapa da demonstração não concluída. Confira a mensagem acima.')));
 });
}
const wrangler=args=>command(process.execPath,[resolve(root,'node_modules/wrangler/bin/wrangler.js'),...args,'--config',configPath,'--env-file',resolve(root,'apps/api/demo/local.env')]);
function remoteReady(){if(db.database_id.startsWith('00000000-'))throw new Error('Execute npm run demo:db:create para criar o D1 exclusivo.');}
async function build(){
 const output=resolve(root,'apps/web/out'),backup=resolve(root,'build/demo-build-backup'),assets=resolve(root,'build/demo-assets');
 if(existsSync(backup))throw new Error('Há um backup de build em build/demo-build-backup. Restaure-o para apps/web/out antes de tentar novamente.');
 mkdirSync(resolve(root,'build'),{recursive:true});
 const hadOutput=existsSync(output);if(hadOutput)renameSync(output,backup);
 try{
  await command('npm',['run','web:build'],{...environment,NEXT_PUBLIC_DEMO:'1',NEXT_PUBLIC_DEMO_URL:''});
  rmSync(assets,{recursive:true,force:true});cpSync(output,assets,{recursive:true});
 }finally{
  rmSync(output,{recursive:true,force:true});if(hadOutput)renameSync(backup,output);
 }
}
async function main(){
 const action=process.argv[2];
 if(action==='build')return build();
 if(action==='check'){await build();return wrangler(['deploy','--dry-run','--outdir',resolve(root,'build/demo-worker')]);}
 if(action==='db:create'){
  if(!db.database_id.startsWith('00000000-'))throw new Error('Já existe um D1 vinculado à demonstração. Use demo:db:migrate.');
  return wrangler(['d1','create',db.database_name,'--binding','DB','--update-config']);
 }
 if(action==='db:migrate'){
  remoteReady();await wrangler(['d1','migrations','apply','DB','--remote']);
  return wrangler(['d1','execute','DB','--remote','--file',resolve(root,'apps/api/demo/schema.sql')]);
 }
 if(action==='deploy'){remoteReady();await build();return wrangler(['deploy']);}
 if(action==='dev'){
  await build();const persist=resolve(root,'.wrangler/public-demo');
  await wrangler(['d1','migrations','apply','DB','--local','--persist-to',persist]);
  await wrangler(['d1','execute','DB','--local','--persist-to',persist,'--file',resolve(root,'apps/api/demo/schema.sql')]);
  return wrangler(['dev','--local','--persist-to',persist,'--var','APP_ORIGIN:https://localhost:8789']);
 }
 throw new Error('Ação desconhecida. Use os scripts demo:* do package.json.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
