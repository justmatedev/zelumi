import {normalizeCategoryDescription,chooseLocalCategory} from '@zelumi/finance/category-memory';
import {expenseCategories} from '@zelumi/finance/categories';
import {CategoryStore} from './store.mjs';
import {inferCategory,CATEGORY_PROMPT_VERSION,DEFAULT_CATEGORY_MODEL} from './workers-ai.mjs';
const limit=(value,fallback)=>/^\d+$/.test(String(value))&&Number(value)>0?Math.min(Number(value),10000):fallback;

export async function resolveCategory({db,owner,record,nowMs=Date.now(),env={}}){
 const store=new CategoryStore(db),key=normalizeCategoryDescription(record.description),model=env.CATEGORY_AI_MODEL||DEFAULT_CATEGORY_MODEL,modelVersion=`${model}:${CATEGORY_PROMPT_VERSION}`;
 const memory=await store.lookup(owner,key,nowMs,modelVersion);
 const terms=store.terms?await store.terms(owner):[];
 const local=chooseLocalCategory({type:record.type,description:record.description,manual:memory.manual,terms});
 if(!local.needsAI)return local;
 if(memory.ai)return {category:memory.ai,source:'ai-cache'};
 if(env.CATEGORY_AI_ENABLED!=='true'||env.CATEGORY_AI_PLAN!=='free'||!env.AI?.run||await store.blocked(nowMs))return local;
 const dayUTC=new Date(nowMs).toISOString().slice(0,10);
 if(!await store.reserveAttempt(owner,dayUTC,{global:limit(env.CATEGORY_AI_DAILY_LIMIT,200),user:limit(env.CATEGORY_AI_USER_DAILY_LIMIT,20)}))return local;
 const result=await inferCategory(env.AI,{description:record.description,categories:expenseCategories,model});
 if(result.status==='ok'){
  await store.cacheAI(owner,key,result.category,modelVersion,nowMs);
  return {category:result.category,source:'ai'};
 }
 if(result.status==='quota')await store.pause(Date.parse(dayUTC+'T00:00:00Z')+86400000,'quota');
 else if(['transient','timeout'].includes(result.status))await store.pause(nowMs+60000,result.status);
 return {...local,source:'ai-fallback'};
}
