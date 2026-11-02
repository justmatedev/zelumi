import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
export function exportLocal(path,output,now=Date.now()) {
 if(!existsSync(path))throw new Error('Banco local não encontrado. Não há dados para exportar.');
 const db=new DatabaseSync(path,{readOnly:true});
 try{
   db.exec('BEGIN');
   const bot=db.prepare("SELECT value FROM meta WHERE key='bot_id'").get()?.value;
   const pending=db.prepare('SELECT COUNT(*) AS n FROM outbox').get().n;
   if(pending)throw new Error('Há respostas pendentes no bot local. Deixe-o entregá-las e pare-o com Ctrl+C antes de exportar.');
   if(!bot)throw new Error('Banco ainda não vinculado a um bot.');
   const rows=db.prepare('SELECT id,owner,body FROM records ORDER BY id').all();
   // Uma coluna import_bot torna o lote inteiro inócuo se apontar para outro bot.
   const gate=`EXISTS(SELECT 1 FROM cloud_meta WHERE key='bot_id' AND value=${quote(bot)})`;
   const lines=[`INSERT OR IGNORE INTO cloud_meta(key,value) VALUES ('bot_id',${quote(bot)});`];
   for(const row of rows){
     lines.push(`INSERT OR IGNORE INTO cloud_records(id,owner,body) SELECT ${quote(row.id)},${quote(row.owner)},${quote(row.body)} WHERE ${gate};`);
     // SQLite changes() refers to the preceding insert: duplicate imports stay inert.
     lines.push(`INSERT INTO cloud_state(owner,version) SELECT ${quote(row.owner)},1 WHERE changes()>0 AND ${gate} ON CONFLICT(owner) DO UPDATE SET version=cloud_state.version+1;`);
   }
   for(const row of db.prepare('SELECT id FROM processed').all()) lines.push(`INSERT OR IGNORE INTO cloud_processed(id,owner,attempt,created_at) SELECT ${Number(row.id)},'imported','import-local',${now} WHERE ${gate};`);
   for(const row of db.prepare('SELECT owner,body FROM pending').all()) {
     if(JSON.parse(row.body).expires>now)lines.push(`INSERT INTO cloud_state(owner,pending) SELECT ${quote(row.owner)},${quote(row.body)} WHERE ${gate} ON CONFLICT(owner) DO UPDATE SET pending=excluded.pending WHERE cloud_state.pending IS NULL;`);
   }
   mkdirSync(dirname(output),{recursive:true,mode:0o700});
   writeFileSync(output,lines.join('\n')+'\n',{mode:0o600});
   return rows.length;
 }finally{db.close();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
    if(existsSync(resolve(root,'.env')))process.loadEnvFile(resolve(root,'.env'));
    const count=exportLocal(resolve(root,process.env.BOT_DB_PATH||'data/zelumi.sqlite'),resolve(root,'data/cloudflare-import.sql'));
    console.log(`${count} registro(s) exportado(s) para data/cloudflare-import.sql. Nenhum dado foi enviado. O arquivo é privado e está ignorado pelo Git.`);
  } catch(error){console.error(error.message);process.exitCode=1;}
}
