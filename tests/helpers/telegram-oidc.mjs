import {generateKeyPairSync,sign as rsaSign} from 'node:crypto';
import {createLocalJWKSet} from 'jose';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
export const jwk={...publicKey.export({format:'jwk'}),kid:'test-key',alg:'RS256',use:'sig'};
export const telegramKeys=createLocalJWKSet({keys:[jwk]});
export const nowMs=1793617200000;
export const nonce='a'.repeat(64);
export const claims=(extra={})=>({iss:'https://oauth.telegram.org',aud:'123',sub:'opaque-subject',iat:nowMs/1000,exp:nowMs/1000+300,id:11,name:'João <>&',nonce,...extra});
export function signClaims(payload,header={alg:'RS256',kid:'test-key'}){
 const input=[header,payload].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
 return input+'.'+rsaSign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url');
}
