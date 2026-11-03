import {createHash} from 'node:crypto';
import {readStored,normalizeSearch} from '../model.mjs';
export const recordVersion=body=>createHash('sha256').update(body).digest('hex');
export function buildProjection(body){
 const r=readStored(body);
 return {version:recordVersion(body),searchName:normalizeSearch(r.description),scheduleJson:JSON.stringify(r.schedule),firstMonth:r.schedule[0].date.slice(0,7),lastMonth:r.schedule.at(-1).date.slice(0,7)};
}
