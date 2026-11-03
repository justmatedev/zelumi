export const LOCAL_ORIGIN='https://localhost:3000';
export const localEnv={APP_ORIGIN:LOCAL_ORIGIN,TELEGRAM_BOT_TOKEN:'999000:local_demo_only',TELEGRAM_BOT_USERNAME:'local_demo_bot',BOT_TIMEZONE:'America/Sao_Paulo',TELEGRAM_WEBHOOK_SECRET:'local_demo_webhook_disabled_00000000'};
export const DEMO_OWNER='90000000';
export async function seedDemo(db,now=new Date()){
 const marker=await db.prepare("SELECT value FROM cloud_meta WHERE key='local_demo_seeded'").first();
 if(marker)return;
 const existing=await db.prepare('SELECT COUNT(*) AS count FROM cloud_records').first();
 const bot=await db.prepare("SELECT value FROM cloud_meta WHERE key='bot_id'").first();
 if(existing.count||bot&&bot.value!=='999000')throw new Error('O seed exige um banco local vazio de demonstração.');
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(now);
 const month=parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;
 const records=[
  ['Salário de exemplo','receita','Receitas',650000,1],
  ['Aluguel de exemplo','despesa','Casa',140000,1],
  ['Mercado de exemplo','despesa','Alimentação',28090,1],
  ['Transporte de exemplo','despesa','Transporte',5000,1],
  ['Notebook de exemplo','despesa','Outros',120000,6]
 ];
 await db.batch([
  db.prepare("INSERT OR IGNORE INTO cloud_meta(key,value) VALUES('bot_id','999000')"),
  db.prepare('INSERT INTO web_users VALUES(?,?,?,?,?,?)').bind(DEMO_OWNER,'Conta de teste',null,'zelumi_local',now.getTime(),now.getTime()),
  ...records.map(([description,type,category,amount,installments],index)=>db.prepare('INSERT INTO cloud_records(id,owner,body) VALUES(?,?,?)').bind(String(90000001+index),DEMO_OWNER,JSON.stringify({description,type,category,amount,installments,date:month+'-01',installmentStartMonth:installments>1?month:null}))),
  db.prepare("INSERT INTO cloud_meta(key,value) VALUES('local_demo_seeded',?)").bind(month)
 ]);
}
