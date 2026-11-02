import {missingSQL,missingAnySQL,projectionInsert,projectionArgs} from '../../finance/sql.mjs';
import {FinanceError} from '../../finance/model.mjs';
export async function prepareOwner(db,owner,{limit=20}={}){
 const {results}=await db.prepare(missingSQL('cloud_records')).bind(owner,limit).all();
 try{if(results.length)await db.batch(results.map(r=>db.prepare(projectionInsert('cloud_records')).bind(...projectionArgs(owner,r.id,r.body))));}
 catch(error){if(error instanceof FinanceError)return {status:'invalid'};throw error;}
 const left=await db.prepare(missingAnySQL('cloud_records')).bind(owner,1).first();return {status:left?'preparing':'ready'};
}
