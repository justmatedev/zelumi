import {spawn} from 'node:child_process';
import {readFileSync,appendFileSync,mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createTelegram} from '@zelumi/bot-core/telegram';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const action=process.argv[2];
const configPath=resolve(root,'apps/api/wrangler.jsonc');
const localPersist=resolve(root,'.wrangler/state');
const wrangler=resolve(root,'node_modules/wrangler/bin/wrangler.js');
const childEnv={...process.env,NEXT_TELEMETRY_DISABLED:'1',WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:resolve(root,'.wrangler/logs'),XDG_CONFIG_HOME:resolve(root,'.wrangler/auth')};
function command(executable,args,input) {
  return new Promise((yes,no)=>{
    const child=spawn(executable,args,{cwd:root,env:childEnv,stdio:[input===undefined?'inherit':'pipe','inherit','inherit']});
    if(input!==undefined){child.stdin.on('error',()=>{});child.stdin.end(input);}
    child.on('error',()=>no(new Error('Não foi possível executar a etapa. Confira as dependências instaladas.')));
    child.on('exit',code=>code===0?yes():no(new Error('A etapa não foi concluída. Confira a mensagem acima.')));
  });
}
const run=(args,input)=>command(process.execPath,[wrangler,...args,'--config',configPath],input);
const buildWeb=()=>command('npm',['run','web:build']);
function remoteReady() {
  const source=readFileSync(configPath,'utf8');
  if(source.includes('00000000-0000-0000-0000-000000000000'))throw new Error('Primeiro execute npm run cf:db:create para vincular um D1 real.');
}
function localSecrets() {
  const path=resolve(root,'.env');
  if(!existsSync(path))throw new Error('Crie .env a partir de .env.example.');
  process.loadEnvFile(path);
  if(!/^\d+:[A-Za-z0-9_-]+$/.test(process.env.TELEGRAM_BOT_TOKEN||''))throw new Error('Preencha TELEGRAM_BOT_TOKEN em .env.');
  if(!process.env.TELEGRAM_WEBHOOK_SECRET){
    const secret=randomBytes(32).toString('hex');
    appendFileSync(path,`\nTELEGRAM_WEBHOOK_SECRET=${secret}\n`,{mode:0o600});
    process.env.TELEGRAM_WEBHOOK_SECRET=secret;
  }
  if(!/^[A-Za-z0-9_-]{32,256}$/.test(process.env.TELEGRAM_WEBHOOK_SECRET))throw new Error('TELEGRAM_WEBHOOK_SECRET deve conter entre 32 e 256 letras, números, _ ou -.');
  const proxy=process.env.VERCEL_PROXY_SECRET;
  if(proxy&&!/^[a-f0-9]{64}$/.test(proxy))throw new Error('VERCEL_PROXY_SECRET deve conter 64 caracteres hexadecimais minúsculos.');
  return {TELEGRAM_BOT_TOKEN:process.env.TELEGRAM_BOT_TOKEN,TELEGRAM_WEBHOOK_SECRET:process.env.TELEGRAM_WEBHOOK_SECRET,...(proxy?{VERCEL_PROXY_SECRET:proxy}:{})};
}
async function main() {
  if(action==='login')return run(['login','--browser=false']);
  if(action==='whoami')return run(['whoami']);
  if(action==='db:create') {
    const source=readFileSync(configPath,'utf8');
    if(!source.includes('00000000-0000-0000-0000-000000000000'))throw new Error('Já existe um D1 vinculado. Use cf:db:migrate.');
    return run(['d1','create','zelumi','--binding','DB','--update-config']);
  }
  if(action==='db:migrate'){remoteReady();return run(['d1','migrations','apply','DB','--remote']);}
  if(action==='db:migrate:local')return run(['d1','migrations','apply','DB','--local','--persist-to',localPersist,'--env-file',resolve(root,existsSync(resolve(root,'.dev.vars'))?'.dev.vars':'.dev.vars.example')]);
  if(action==='db:pending'){remoteReady();return run(['d1','migrations','list','DB','--remote']);}
  if(action==='versions')return run(['versions','list']);
  if(action==='check'){await buildWeb();return run(['deploy','--dry-run','--outdir','build/worker']);}
  if(action==='dev'){await buildWeb();return run(['dev','--local','--persist-to',localPersist,'--env-file',resolve(root,existsSync(resolve(root,'.dev.vars'))?'.dev.vars':'.dev.vars.example')]);}
  if(action==='deploy'){
    remoteReady();await buildWeb();
    const secrets=localSecrets(),me=await createTelegram(secrets.TELEGRAM_BOT_TOKEN)('getMe');
    const config=JSON.parse(readFileSync(configPath,'utf8'));
    if(me.username!==config.vars.TELEGRAM_BOT_USERNAME)throw new Error('O username de login não corresponde ao token do bot. Corrija a configuração antes de publicar.');
    return run(['deploy']);
  }
  if(action==='secrets'){remoteReady();return run(['secret','bulk'],JSON.stringify(localSecrets()));}
  if(action==='db:import'){
    remoteReady();const path=resolve(root,'data/cloudflare-import.sql');
    if(!existsSync(path))throw new Error('Primeiro execute npm run cf:export-local.');
    return run(['d1','execute','DB','--remote','--file',path]);
  }
  if(action==='activate') {
    const secrets=localSecrets(),raw=process.argv[3];
    if(!raw)throw new Error('Informe a URL impressa no deploy: npm run cf:activate -- https://NOME.SUBDOMINIO.workers.dev');
    const url=new URL(raw);
    if(url.protocol!=='https:'||!url.hostname.endsWith('.workers.dev')||url.username||url.password)throw new Error('Use a URL HTTPS workers.dev retornada pelo deploy.');
    let ready=false;
    for(let attempt=0;attempt<5;attempt++) {
      try {
        const health=await fetch(new URL('/health',url),{signal:AbortSignal.timeout(15000)});
        ready=health.ok&&(await health.json()).service==='zelumi-bot';
      } catch { /* Um endereço workers.dev recém-criado pode não ter HTTPS pronto. */ }
      if(ready)break;
      if(attempt<4){console.log('Aguardando o HTTPS do Worker ficar disponível...');await delay(15000);}
    }
    if(!ready)throw new Error('O HTTPS do Worker ainda não está disponível ou falta configurar os segredos. Confira /health no navegador e tente cf:activate novamente. O webhook não foi alterado.');
    const api=createTelegram(secrets.TELEGRAM_BOT_TOKEN);
    await api('getMe');
    const current=await api('getWebhookInfo'),target=new URL('/telegram/webhook',url).href;
    if(current.url&&current.url!==target&&!process.argv.includes('--replace-webhook'))throw new Error('Já existe outro webhook. Confira antes de usar --replace-webhook.');
    const outcome=await api('setWebhook',{url:target,secret_token:secrets.TELEGRAM_WEBHOOK_SECRET,max_connections:1,drop_pending_updates:false,allowed_updates:['message','callback_query']});
    if(!outcome||(await api('getWebhookInfo')).url!==target)throw new Error('Não foi possível confirmar o webhook.');
    console.log('Webhook registrado. Envie “pão 10” no Telegram e confirme a resposta. O bot local deve permanecer desligado.');
    return;
  }
  if(action==='webhook:status'){
    const secrets=localSecrets(),info=await createTelegram(secrets.TELEGRAM_BOT_TOKEN)('getWebhookInfo');
    console.log(JSON.stringify({active:Boolean(info.url),pendingUpdates:info.pending_update_count,lastDeliveryFailed:Boolean(info.last_error_date)},null,2));return;
  }
  throw new Error('Ação desconhecida. Use os scripts cf:* do package.json.');
}
main().catch(error=>{console.error(error.message?.includes('https://api.telegram.org/bot')?'Falha na conexão com o Telegram.':error.message);process.exitCode=1;});
