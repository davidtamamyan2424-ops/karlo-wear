import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root=resolve('.'), destination=resolve('release','staging-'+Date.now(),'security-update');
await mkdir(destination,{recursive:true});
const allowed=new Set(['src','prisma','scripts','public']);
async function copyTree(source,target) {
  await mkdir(target,{recursive:true});
  for(const entry of await readdir(source,{withFileTypes:true})) {
    const src=resolve(source,entry.name), dst=resolve(target,entry.name);
    if(entry.isDirectory()) { if(allowed.has(entry.name)||source.includes(resolve(root,'client/src'))||source.includes(resolve(root,'server/src'))||source.includes(resolve(root,'server/prisma'))||source.includes(resolve(root,'client/public')))await copyTree(src,dst); }
    else if(entry.isFile() && !entry.name.endsWith('.tsbuildinfo') && (entry.name==='.env.example'||!entry.name.startsWith('.env')) && (entry.name==='.env.example'||/\.(json|js|mjs|ts|tsx|css|html|md|sql|prisma|toml|sh|webp|png|svg|ico|txt)$/.test(entry.name))) await cp(src,dst);
  }
}
await copyTree(resolve('client'),resolve(destination,'client'));
await copyTree(resolve('server'),resolve(destination,'server'));
await copyTree(resolve('scripts'),resolve(destination,'scripts'));
for(const file of ['package.json','package-lock.json'])await cp(file,resolve(destination,file));
await cp('audit/SECURITY-FIXES-2026-10-22.md',resolve(destination,'SECURITY-FIXES.md'));
// POSIX shell scripts must not contain Windows CRLF line endings.
const shell=resolve(destination,'scripts/deploy-security.sh');
await writeFile(shell,(await readFile(shell,'utf8')).replaceAll('\r\n','\n'));
const archive=resolve('release/karlo-security-update.tar.gz');
const result=spawnSync('tar',['-czf',archive,'-C',dirname(destination),'security-update'],{stdio:'inherit',windowsHide:true});
if(result.status!==0)throw new Error('Archive creation failed');
const contents=spawnSync('tar',['-tzf',archive],{encoding:'utf8',windowsHide:true});
if(contents.status!==0)throw new Error('Archive verification failed');
const entries=new Set(contents.stdout.split(/\r?\n/));
for(const file of ['server/prisma/schema.prisma','server/prisma/migrations/20261022140000_security_hardening/migration.sql','server/src/index.ts','client/src/main.tsx','client/src/assets/karlo-hero.webp','scripts/backup-db.mjs','scripts/maintenance.mjs','scripts/deploy-security.sh','package-lock.json']) {
  if(!entries.has('security-update/'+file))throw new Error('Missing required archive file: '+file);
}
for(const entry of entries)if(/\/(?:\.env|dev\.db)(?:$|-)|\/(?:node_modules|uploads|private|dist)\//.test(entry))throw new Error('Unexpected private or generated file in archive: '+entry);
const digest=createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile(archive+'.sha256',digest+'  '+relative(resolve('release'),archive)+'\n');
console.log(archive);console.log('SHA256:',digest);
