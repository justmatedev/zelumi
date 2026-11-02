import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {verifyTelegramPayload} from '../cloudflare/auth/telegram.mjs';
import {randomToken,hashToken,deriveCsrf} from '../cloudflare/auth/crypto.mjs';

const botToken='123:fake',nowMs=1793617200000;
const sign=(fields)=>({...fields,hash:createHmac('sha256',createHash('sha256').update(botToken).digest()).update(Object.keys(fields).sort().map(k=>`${k}=${fields[k]}`).join('\n')).digest('hex')});
const base={id:11,first_name:'João <>&',auth_date:nowMs/1000};
const verify=p=>verifyTelegramPayload(p,{botToken,nowMs});
test('valida assinatura oficial e normaliza identidade sem mudar os campos assinados',async()=>{
 const p=await verify(sign(base));assert.equal(p.owner,'11');assert.equal(p.firstName,'João <>&');assert.equal(p.username,null);
 assert.equal((await verify(sign({...base,last_name:'',username:'nome'}))).lastName,'');
 assert.equal((await verify(sign({...base,id:'11',auth_date:String(base.auth_date)}))).owner,'11');
 assert.match(p.payloadHash,/^[a-f0-9]{64}$/);
});
test('rejeita alterações, campos desconhecidos, tipos e IDs não canônicos',async()=>{
 const invalid=[null,[],{}, {...sign(base),first_name:'outro'}, {...sign(base),hash:'z'.repeat(64)},sign({...base,extra:'x'}),sign({...base,id:0}),sign({...base,id:1.1}),sign({...base,id:Number.MAX_SAFE_INTEGER+1}),sign({...base,id:'011'}),sign({...base,id:{}}),sign({...base,first_name:[]}),sign({...base,username:{}})];
 for(const p of invalid)await assert.rejects(verify(p),e=>!e.message.includes(botToken));
});
test('confere idade máxima e tolerância futura pelo relógio do servidor',async()=>{
 for(const offset of [-300,30])await verify(sign({...base,auth_date:base.auth_date+offset}));
 for(const offset of [-301,31])await assert.rejects(verify(sign({...base,auth_date:base.auth_date+offset})));
 await assert.rejects(verify(sign({...base,auth_date:'1.2'})));
});
test('tokens e CSRF têm entropia e separação de propósito',async()=>{
 const a=randomToken(),b=randomToken();assert.notEqual(a,b);assert.match(a,/^[a-f0-9]{64}$/);
 assert.notEqual(await hashToken(a),a);
 assert.notEqual(await deriveCsrf(a,botToken,'session'),await deriveCsrf(a,botToken,'network'));
});
