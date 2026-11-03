import {isIP} from 'node:net';
import {constantTimeEqual} from './crypto.mjs';

// Forwarded visitor headers are trusted only when our proxy authenticates itself.
export function loginNetwork(request,env) {
 const secret=env.VERCEL_PROXY_SECRET,provided=request.headers.get('X-Zelumi-Proxy-Secret');
 const visitor=request.headers.get('X-Real-IP');
 if(/^[a-f0-9]{64}$/.test(secret||'')&&constantTimeEqual(provided,secret)&&isIP(visitor||''))return `vercel:${visitor.toLowerCase()}`;
 return request.cf?request.headers.get('CF-Connecting-IP')||'unknown':'local-development';
}
