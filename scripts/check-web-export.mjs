import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../web/out');
const required=['index.html','visao-geral/index.html','lancamentos/index.html','perfil/index.html','404.html','brand/simbolo.svg','telegram-widget.html','telegram-widget.js','_headers'];
for(const path of required)if(!existsSync(resolve(root,path)))throw new Error(`Export incompleto: ${path}`);
function scan(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(resolve(dir,e.name)):[resolve(dir,e.name)]);}
const files=scan(root);
if(!files.some(f=>/\.(ttf|woff2?)$/.test(f)))throw new Error('Fontes locais ausentes.');
for(const file of files){
 const path=relative(root,file);
 if(/(^|\/)(\.env[^/]*|\.wrangler|node_modules|\.git)(\/|$)|\.(sqlite|sql|map|toml)$/.test(path))throw new Error(`Arquivo privado/gerado indevido no export: ${path}`);
 if(/\.(html|js|json|txt)$/.test(file)&&/\b\d{5,}:[A-Za-z0-9_-]{30,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(readFileSync(file,'utf8')))throw new Error(`Possível credencial no export: ${path}`);
}
console.log(`Export verificado: ${files.length} arquivos, páginas, fontes e marca presentes; sem arquivos privados conhecidos.`);
