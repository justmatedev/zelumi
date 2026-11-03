import {config,cookie} from './http.mjs';
import {AuthStore} from './store.mjs';
import {hashToken,deriveCsrf} from './crypto.mjs';
import {assertBotBinding} from '../telegram/bot-binding.mjs';
export async function getSessionContext(request,env,nowMs){
 config(env);await assertBotBinding(env);const token=cookie(request,'__Host-zelumi_session');if(!token)return null;
 const db=env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
 const sessionHash=await hashToken(token),profile=await new AuthStore(db).getSession(sessionHash,nowMs);if(!profile)return null;
 return {owner:profile.owner,user:{firstName:profile.first_name,lastName:profile.last_name,username:profile.username},csrfToken:await deriveCsrf(token,env.TELEGRAM_BOT_TOKEN,'session'),db,authorization:{sessionHash,botId:env.TELEGRAM_BOT_TOKEN.split(':')[0]}};
}
