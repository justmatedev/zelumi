import { randomUUID } from 'node:crypto';
import { TelegramError } from '../bot/telegram.mjs';

export async function deliver(db,api,{now=Date.now(),limit=10,updateId,botId}={}) {
  if(!/^[1-9]\d*$/.test(botId||''))throw new Error('Identidade do bot ausente para entrega.');
  let sent=0;
  for(let i=0;i<limit;i++) {
    const lease=randomUUID();
    const scope=updateId===undefined?'':' AND update_id=?';
    const args=[lease,now+120000,now,now,botId,...(updateId===undefined?[]:[updateId])];
    const row=await db.prepare(`UPDATE cloud_outbox SET lease=?,lease_until=? WHERE id=(SELECT id FROM cloud_outbox WHERE next_attempt<=? AND lease_until<=? AND EXISTS(SELECT 1 FROM cloud_meta WHERE key='bot_id' AND value=?)${scope} ORDER BY id LIMIT 1) RETURNING id,method,payload`).bind(...args).first();
    if(!row)break;
    try {
      await api(row.method,JSON.parse(row.payload));
      await db.prepare('DELETE FROM cloud_outbox WHERE id=? AND lease=?').bind(row.id,lease).run();sent++;
    } catch(error) {
      if(error instanceof TelegramError && [400,403].includes(error.code)) {
        await db.prepare('DELETE FROM cloud_outbox WHERE id=? AND lease=?').bind(row.id,lease).run();
      } else {
        const retry=Math.max(60,Number(error.retryAfter)||0);
        await db.prepare('UPDATE cloud_outbox SET lease=NULL,lease_until=0,next_attempt=? WHERE id=? AND lease=?').bind(now+retry*1000,row.id,lease).run();
        break;
      }
    }
  }
  return sent;
}
