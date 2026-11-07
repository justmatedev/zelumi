import {createRemoteJWKSet,jwtVerify,errors} from 'jose';
import {constantTimeEqual,hashToken} from './crypto.mjs';

export class InvalidTelegramPayload extends Error {
 constructor(){super('Autorização Telegram inválida ou expirada.');this.name='InvalidTelegramPayload';}
}
// Fixed trusted endpoint: never use jku/x5u or a key URL supplied by a token.
const telegramKeys=createRemoteJWKSet(new URL('https://oauth.telegram.org/.well-known/jwks.json'),{
 timeoutDuration:5000,cooldownDuration:30000,cacheMaxAge:600000
});
function positiveInteger(value) {
 if(typeof value==='number')return Number.isSafeInteger(value)&&value>0?String(value):null;
 if(typeof value!=='string'||! /^[1-9]\d{0,15}$/.test(value))return null;
 return Number.isSafeInteger(Number(value))?value:null;
}
export async function verifyTelegramIdToken(token,{botId,nonce,nowMs,keys=telegramKeys}) {
 const invalid=()=>{throw new InvalidTelegramPayload();};
 if(typeof token!=='string'||token.length>12000||!token)invalid();
 let payload;
 try {
  ({payload}=await jwtVerify(token,keys,{
   algorithms:['RS256'],issuer:'https://oauth.telegram.org',audience:botId,
   requiredClaims:['exp','iat','sub','nonce'],maxTokenAge:300,clockTolerance:30,currentDate:new Date(nowMs)
  }));
 } catch(error) {
  if(error instanceof errors.JWTClaimValidationFailed||error instanceof errors.JWTExpired||
   error instanceof errors.JWTInvalid||error instanceof errors.JWSInvalid||
   error instanceof errors.JWSSignatureVerificationFailed||error instanceof errors.JOSENotSupported||
   error instanceof errors.JOSEAlgNotAllowed||error instanceof errors.JWKSNoMatchingKey)invalid();
  // Key-service/network failures must remain 503 at the route, rather than
  // being confused with an invalid login. No unverified claims are accepted.
  throw error;
 }
 if(payload.aud!==botId||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>256||
  !constantTimeEqual(payload.nonce,nonce)||!Number.isInteger(payload.iat)||!Number.isInteger(payload.exp)||payload.exp<=payload.iat)invalid();
 // OIDC sub is opaque. Only the signed profile id identifies the Bot API user
 // and therefore the owner of the existing financial records.
 const owner=positiveInteger(payload.id),firstName=payload.given_name??payload.name;
 if(!owner||typeof firstName!=='string'||!firstName||firstName.length>512)invalid();
 if(payload.name!==undefined&&(typeof payload.name!=='string'||!payload.name||payload.name.length>512))invalid();
 for(const key of ['family_name','preferred_username'])if(key in payload&&(typeof payload[key]!=='string'||payload[key].length>4096))invalid();
 return {owner,firstName,lastName:payload.family_name??null,username:payload.preferred_username??null,payloadHash:await hashToken(token)};
}
