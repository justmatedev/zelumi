import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

test('pacotes públicos resolvem regras financeiras e execução do bot',async()=>{
 const {parse}=await import('@zelumi/finance/parser');
 const {recordVersion}=await import('@zelumi/finance/server/version');
 const {handleUpdate}=await import('@zelumi/bot-core/engine');
 const {createTelegram,TelegramError}=await import('@zelumi/bot-core/telegram');
 assert.equal(parse('pão 10',new Date(2026,10,2)).amount,1000);
 assert.equal(recordVersion('registro'),recordVersion('registro'));
 assert.match(recordVersion('registro'),/^[a-f0-9]{64}$/);
 assert.equal(typeof handleUpdate,'function');
 assert.equal(typeof createTelegram,'function');
 assert.ok(new TelegramError('teste') instanceof Error);
});

test('modelo financeiro pode ser compilado para navegador sem dependências Node',async()=>{
 const result=await build({stdin:{contents:"export {validateEdit,schedule,categories} from '@zelumi/finance/model';",resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'esm',metafile:true,logLevel:'silent'});
 assert.ok(result.outputFiles[0].text.length>0);
 assert.ok(Object.keys(result.metafile.inputs).every(path=>!path.includes('/server/')));
});
