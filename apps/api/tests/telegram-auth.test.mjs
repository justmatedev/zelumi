import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as telegram from '../src/auth/telegram.mjs';
import {randomToken,hashToken,deriveCsrf} from '../src/auth/crypto.mjs';
import {claims,signClaims,telegramKeys,nonce,nowMs} from '../../../tests/helpers/telegram-oidc.mjs';
const verify=(token,options={})=>telegram.verifyTelegramIdToken(token,{botId:'123',nonce,nowMs,keys:telegramKeys,...options});
test('valida JWT RS256 e preserva o ID numérico financeiro em vez de sub',async()=>{
 const token=signClaims(claims());const p=await verify(token);
 assert.equal(p.owner,'11');assert.equal(p.firstName,'João <>&');assert.equal(p.username,null);
 assert.equal(p.payloadHash,await hashToken(token));
 const names=await verify(signClaims(claims({given_name:'João',family_name:'Silva',preferred_username:'joao'})));
 assert.equal(names.firstName,'João');assert.equal(names.lastName,'Silva');assert.equal(names.username,'joao');
});
test('rejeita assinatura alterada, alg none, chave desconhecida e objetos do login legado',async()=>{
 const token=signClaims(claims());const parts=token.split('.');
 parts[1]=Buffer.from(JSON.stringify(claims({id:22}))).toString('base64url');
 for(const value of [null,{}, {id:11,hash:'signed'},'',parts.join('.'),signClaims(claims(),{alg:'none'}),signClaims(claims(),{alg:'HS256'}),signClaims(claims(),{alg:'RS256',kid:'unknown'})])await assert.rejects(verify(value),{name:'InvalidTelegramPayload'});
});
test('recusa issuer, audience, nonce e datas inválidos ou ausentes',async()=>{
 for(const extra of [{iss:'https://evil.example'},{aud:'456'},{aud:['123','456']},{nonce:'other'},{nonce:undefined},{exp:nowMs/1000-31},{exp:undefined},{iat:undefined},{iat:nowMs/1000-331},{iat:nowMs/1000+31},{exp:nowMs/1000-1,iat:nowMs/1000+1},{sub:undefined},{sub:''}]){
  await assert.rejects(verify(signClaims(claims(extra))),{name:'InvalidTelegramPayload'},JSON.stringify(extra));
 }
 await verify(signClaims(claims({iat:nowMs/1000-300})));
});
test('recusa identidade não canônica e campos de perfil inválidos',async()=>{
 for(const extra of [{id:undefined},{id:0},{id:1.1},{id:Number.MAX_SAFE_INTEGER+1},{id:'011'},{id:{}},{name:[]},{name:''},{given_name:[]},{family_name:{}},{preferred_username:{}}])await assert.rejects(verify(signClaims(claims(extra))),{name:'InvalidTelegramPayload'});
 assert.equal((await verify(signClaims(claims({id:'11'})))).owner,'11');
});
test('falha de consulta de chaves permanece indisponibilidade, sem aceitar o token',async()=>{
 await assert.rejects(verify(signClaims(claims()),{keys:async()=>{throw new Error('unavailable');}}),/unavailable/);
});
test('tokens e CSRF têm entropia e separação de propósito',async()=>{
 const a=randomToken(),b=randomToken();assert.notEqual(a,b);assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(await hashToken(a),a);
 assert.notEqual(await deriveCsrf(a,'123:fake','session'),await deriveCsrf(a,'123:fake','network'));
});
