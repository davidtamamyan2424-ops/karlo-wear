#!/usr/bin/env bash
# Requires the systemd/shared-storage layout installed by deploy-security.sh.
set -euo pipefail
umask 022
sha=${1:?Commit SHA required}
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || exit 1
test "$(id -u)" = 0
exec 9>/var/lock/karlo-deploy.lock
flock -n 9 || { echo 'Another deployment is running'; exit 1; }
base=/srv/karlo-wear
payload=$(cd -- "$(dirname -- "$0")/.." && pwd)
previous=$(readlink -f "$base/current")
[[ "$previous" == "$base/releases/"* ]]
test -f "$previous/server/.env"
systemctl is-active --quiet karlo-wear-api.service
for tool in npm node pg_dump pg_restore curl tar flock; do command -v "$tool" >/dev/null; done
release="$base/releases/$(date +%Y%m%d-%H%M%S)-${sha:0:12}"
backup="/var/backups/karlo-wear/deploy-$(date +%Y%m%d-%H%M%S)-${sha:0:12}"
mkdir -m 755 "$release"
install -d -m 700 "$backup"
cp -a "$payload/package.json" "$payload/package-lock.json" "$payload/client" "$payload/server" "$payload/scripts" "$release/"
cp "$previous/server/.env" "$release/server/.env"
chmod 640 "$release/server/.env"
if [ -f "$previous/client/.env" ]; then cp "$previous/client/.env" "$release/client/.env"; fi
cd "$release"
npm ci --include=dev
npm run prisma:generate
npm run typecheck
npm test
npm run build
# A schema change requires a separate reviewed migration; never auto-migrate orders.
node --input-type=module <<'JS'
import {config} from 'dotenv'; config({path:'server/.env'});
import {PrismaClient} from '@prisma/client';
import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const db=new PrismaClient();
try {
  const rows=await db.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`;
  if(rows.some(r=>!r.finished_at&&!r.rolled_back_at))throw Error('Failed migration requires manual review');
  const applied=new Map(rows.filter(r=>r.finished_at&&!r.rolled_back_at).map(r=>[r.migration_name,r.checksum]));
  const dirs=(await readdir('server/prisma/migrations',{withFileTypes:true})).filter(d=>d.isDirectory());
  for(const d of dirs){
    const sql=await readFile(`server/prisma/migrations/${d.name}/migration.sql`);
    const text=sql.toString('utf8');
    const hashes=[sql,text.replace(/\r\n/g,'\n'),text.replace(/\r?\n/g,'\r\n')].map(v=>createHash('sha256').update(v).digest('hex'));
    if(!hashes.includes(applied.get(d.name)))throw Error('New or changed migration requires manual review: '+d.name);
  }
  if(applied.size!==dirs.length)throw Error('Release omits applied migrations');
} finally {await db.$disconnect();}
JS
test -d "$base/shared/uploads"
test -d "$base/shared/private"
ln -s "$base/shared/uploads" server/uploads
ln -s "$base/shared/private" server/private
chgrp -R karlo-wear "$release"
printf '%s\n' "$sha" > REVISION
tar -czf "$backup/site.tar.gz" -C /var/www karlo-wear
stopped=false
switched=false
rollback() {
  code=$?
  trap - EXIT
  if [ "$code" -ne 0 ] && [ "$stopped" = true ]; then
    if [ "$switched" = true ]; then
      ln -sfn "$previous" "$base/current.rollback"
      mv -Tf "$base/current.rollback" "$base/current"
      tar -xzf "$backup/site.tar.gz" -C /var/www
    fi
    systemctl restart karlo-wear-api.service || true
    echo "Deployment failed; previous release restored. Backup: $backup"
  fi
  exit "$code"
}
trap rollback EXIT
systemctl stop karlo-wear-api.service
stopped=true
node scripts/backup-db.mjs "$backup/database.dump"
ln -s "$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
switched=true
systemctl start karlo-wear-api.service
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 2 --max-time 5 http://127.0.0.1:4000/api/ready
# Retain old hashed assets for browsers with an older page open.
cp -a client/dist/assets/. /var/www/karlo-wear/assets/
install -m 644 client/dist/index.html /var/www/karlo-wear/index.html.next
mv /var/www/karlo-wear/index.html.next /var/www/karlo-wear/index.html
curl --fail --silent --show-error --max-time 20 https://karlo-wear.ru/api/ready
echo "Deployed $sha; backup: $backup"
