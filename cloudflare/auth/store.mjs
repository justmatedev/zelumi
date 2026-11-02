export class AuthStore {
 constructor(db){this.db=db;}
 query(sql,...values){return this.db.prepare(sql).bind(...values);}
 async startFlow({flowHash,csrfHash,expiresAt,nowMs,networkKey,previousFlowHash=null}) {
  const window=Math.floor(nowMs/600000)*600000;
  const results=await this.db.batch([
   this.query(`INSERT INTO web_auth_limits(network_key,window_start,count) VALUES(?,?,1)
    ON CONFLICT(network_key,window_start) DO UPDATE SET count=MIN(count+1,6) RETURNING count`,networkKey,window),
   this.query(`INSERT INTO web_auth_flows(token_hash,csrf_hash,created_at,expires_at)
    SELECT ?,?,?,? FROM web_auth_limits WHERE network_key=? AND window_start=? AND count<=5`,flowHash,csrfHash,nowMs,expiresAt,networkKey,window),
   this.query('DELETE FROM web_auth_flows WHERE token_hash=? AND EXISTS(SELECT 1 FROM web_auth_flows WHERE token_hash=?)',previousFlowHash,flowHash)
  ]);
  return {allowed:results[0].results[0].count<=5,retryAfter:Math.ceil((window+600000-nowMs)/1000)};
 }
 getFlow(flowHash){return this.query('SELECT csrf_hash,expires_at FROM web_auth_flows WHERE token_hash=?',flowHash).first();}
 async acceptLogin({flowHash,csrfHash,profile,payloadHash,sessionHash,sessionExpiresAt,nowMs,attemptId}) {
  // A unique receipt gates every subsequent write in the same atomic D1 batch.
  const gate='EXISTS(SELECT 1 FROM web_auth_accepts WHERE attempt_id=?)';
  const results=await this.db.batch([
   this.query(`INSERT INTO web_auth_accepts(flow_hash,payload_hash,attempt_id,created_at)
    SELECT token_hash,?,?,? FROM web_auth_flows WHERE token_hash=? AND csrf_hash=? AND expires_at>?
    ON CONFLICT DO NOTHING`,payloadHash,attemptId,nowMs,flowHash,csrfHash,nowMs),
   this.query(`INSERT INTO web_users(owner,first_name,last_name,username,created_at,updated_at)
    SELECT ?,?,?,?,?,? WHERE ${gate}
    ON CONFLICT(owner) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,username=excluded.username,updated_at=excluded.updated_at`,profile.owner,profile.firstName,profile.lastName,profile.username,nowMs,nowMs,attemptId),
   this.query(`INSERT INTO web_sessions(token_hash,owner,created_at,expires_at) SELECT ?,?,?,? WHERE ${gate}`,sessionHash,profile.owner,nowMs,sessionExpiresAt,attemptId),
   this.query(`DELETE FROM web_auth_flows WHERE token_hash=? AND ${gate}`,flowHash,attemptId)
  ]);
  return results[0].meta.changes===1;
 }
 getSession(hash,nowMs){return this.query(`SELECT s.owner,u.first_name,u.last_name,u.username FROM web_sessions s
  JOIN web_users u ON u.owner=s.owner WHERE s.token_hash=? AND s.expires_at>?`,hash,nowMs).first();}
 deleteSession(hash){return this.query('DELETE FROM web_sessions WHERE token_hash=?',hash).run();}
 async cleanup(nowMs) {
  await this.db.batch([
   this.query('DELETE FROM web_sessions WHERE token_hash IN (SELECT token_hash FROM web_sessions WHERE expires_at<=? LIMIT 500)',nowMs),
   this.query('DELETE FROM web_auth_flows WHERE token_hash IN (SELECT token_hash FROM web_auth_flows WHERE expires_at<=? LIMIT 500)',nowMs),
   this.query('DELETE FROM web_auth_accepts WHERE flow_hash IN (SELECT flow_hash FROM web_auth_accepts WHERE created_at<? LIMIT 500)',nowMs-86400000),
   this.query('DELETE FROM web_auth_limits WHERE (network_key,window_start) IN (SELECT network_key,window_start FROM web_auth_limits WHERE window_start<? LIMIT 500)',nowMs-600000)
  ]);
 }
}
export const cleanupAuth=(db,nowMs)=>new AuthStore(db).cleanup(nowMs);
