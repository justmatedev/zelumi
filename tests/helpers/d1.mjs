import {readFileSync,readdirSync} from 'node:fs';
export async function migrate(db){
 for(const name of readdirSync(new URL('../../apps/api/migrations',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()){
  const sql=readFileSync(new URL(`../../apps/api/migrations/${name}`,import.meta.url),'utf8');
  const statements=sql.split(sql.includes('-- statement-breakpoint')?'-- statement-breakpoint':';').map(s=>s.trim()).filter(Boolean);
  await db.batch(statements.map(s=>db.prepare(s)));
 }
}
