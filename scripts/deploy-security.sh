#!/usr/bin/env bash
set -euo pipefail
umask 022
payload="$(cd -- "$(dirname -- "$0")/.." && pwd)"
base=/srv/karlo-wear
stamp=$(date +%Y%m%d-%H%M%S)
release="$base/releases/$stamp"
backup="/root/karlo-backups/security-$stamp"
previous=/root/karlo-wear
if [ -L "$base/current" ]; then previous=$(readlink -f "$base/current"); fi
test "$(id -u)" = 0 || { echo 'Запустите из root SSH-сессии.'; exit 1; }
test -f "$previous/server/.env"
test -s "$payload/server/prisma/schema.prisma" || { echo 'В архиве отсутствует схема Prisma. Загрузите исправленный архив.'; exit 1; }
for tool in npm pg_dump pg_restore nginx systemctl curl tar python3; do command -v "$tool" >/dev/null; done
test -x /usr/bin/node || { echo 'Нужен Node.js в /usr/bin/node для отдельного системного пользователя.'; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)'
mkdir -p "$release" "$backup" "$base/shared/uploads" "$base/shared/private"
chmod 700 "$backup"
cp -a "$payload/package.json" "$payload/package-lock.json" "$payload/client" "$payload/server" "$payload/scripts" "$release/"
cp "$previous/server/.env" "$release/server/.env"
if [ -f "$previous/client/.env" ]; then cp "$previous/client/.env" "$release/client/.env"; fi
cd "$release"
echo 'Установка и проверка новой версии. Текущий сайт пока продолжает работать.'
npm ci --include=dev
npm run prisma:generate
npm run typecheck
npm test
npm run build
npm audit --omit=dev
tar --exclude='./node_modules' --exclude='./client/node_modules' --exclude='./server/node_modules' --exclude='./server/karlo-wear' -czf "$backup/project.tar.gz" -C "$previous" .
tar -czf "$backup/site.tar.gz" -C /var/www karlo-wear
cp -a /etc/nginx/nginx.conf "$backup/nginx.conf"
site=$(readlink -f /etc/nginx/sites-enabled/karlo-wear)
test -f "$site"
cp -a "$site" "$backup/nginx-site.conf"
if [ -f /etc/nginx/snippets/karlo-security.conf ]; then cp -a /etc/nginx/snippets/karlo-security.conf "$backup/nginx-snippet.conf"; fi
old_systemd=false
if systemctl is-active --quiet karlo-wear-api.service; then old_systemd=true; fi
stopped=false
switched=false
rollback() {
  code=$?
  if [ "$code" -ne 0 ]; then
    echo "Обновление прервано. Копии находятся в $backup"
    cp -a "$backup/nginx-site.conf" "$site"
    if [ -f "$backup/nginx-snippet.conf" ]; then cp -a "$backup/nginx-snippet.conf" /etc/nginx/snippets/karlo-security.conf; fi
    tar -xzf "$backup/site.tar.gz" -C /var/www
    nginx -t && systemctl reload nginx || true
    if [ "$stopped" = true ]; then
      systemctl stop karlo-wear-api.service || true
      if [ "$switched" = true ] && [ "$previous" != /root/karlo-wear ]; then ln -sfn "$previous" "$base/current"; fi
      if [ "$old_systemd" = true ]; then systemctl start karlo-wear-api.service || true
      else pm2 restart karlo-wear-api || true; fi
    fi
    echo 'Миграция только добавляет поля. База автоматически не откатывается, чтобы не терять записи.'
  fi
}
trap rollback EXIT
echo 'Короткая остановка API для согласованной копии и миграции.'
if [ "$old_systemd" = true ]; then systemctl stop karlo-wear-api.service; else pm2 stop karlo-wear-api; fi
stopped=true
node scripts/backup-db.mjs "$backup/database.dump"
if [ "$(readlink -f "$previous/server/uploads")" != "$base/shared/uploads" ]; then cp -a "$previous/server/uploads/." "$base/shared/uploads/"; fi
if [ -d "$previous/server/private" ] && [ "$(readlink -f "$previous/server/private")" != "$base/shared/private" ]; then cp -a "$previous/server/private/." "$base/shared/private/"; fi
ln -s "$base/shared/uploads" "$release/server/uploads"
ln -s "$base/shared/private" "$release/server/private"
if ! id karlo-wear >/dev/null 2>&1; then useradd --system --user-group --home-dir "$base" --shell /usr/sbin/nologin karlo-wear; fi
chown -R karlo-wear:karlo-wear "$base/shared/uploads" "$base/shared/private"
chgrp -R karlo-wear "$release"
chmod 640 "$release/server/.env"
# Legacy receipt URLs remain in the database; the authenticated download route
# resolves them and the public upload allowlist blocks raw receipt files.
npm run prisma:migrate:deploy
chown -R karlo-wear:karlo-wear "$base/shared/private"
# Ensure old size charts and product images have public safe WebP versions.
node --input-type=module <<'IMAGES'
import {config} from 'dotenv'; config({path:'server/.env'});
const {migrateProductImages}=await import('./server/dist/services/migrateProductImages.js');
const {ingestProductImage}=await import('./server/dist/lib/imageOptimize.js');
const {resolveUploadPath}=await import('./server/dist/lib/uploads.js');
const {prisma}=await import('./server/dist/lib/prisma.js');
try {
  await migrateProductImages();
  const products=await prisma.product.findMany({where:{sizeChartUrl:{not:null}}});
  const changed=new Map();
  for(const p of products){
    if(!p.sizeChartUrl.startsWith('/uploads/')||p.sizeChartUrl.endsWith('-full.webp'))continue;
    if(!changed.has(p.sizeChartUrl))changed.set(p.sizeChartUrl,(await ingestProductImage(resolveUploadPath(p.sizeChartUrl))).fullUrl);
    await prisma.product.update({where:{id:p.id},data:{sizeChartUrl:changed.get(p.sizeChartUrl)}});
  }
} finally {await prisma.$disconnect();}
IMAGES
chown -R karlo-wear:karlo-wear "$base/shared/uploads"
cat > /etc/nginx/snippets/karlo-security.conf <<'NGINX'
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy strict-origin-when-cross-origin always;
add_header Strict-Transport-Security "max-age=15552000" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://web.telegram.org https://*.telegram.org" always;
NGINX
python3 - "$site" <<'CONFIG'
import pathlib,sys,re
p=pathlib.Path(sys.argv[1]); s=p.read_text()
if 'include /etc/nginx/snippets/karlo-security.conf;' not in s:
    s=re.sub(r'(\s*server_name\s+karlo-wear\.ru[^;]*;)',r'\1\n    include /etc/nginx/snippets/karlo-security.conf;',s)
s=re.sub(r'\s*client_max_body_size\s+[^;]+;', '', s)
s=re.sub(r'(\s*server_name\s+karlo-wear\.ru[^;]*;)',r'\1\n    client_max_body_size 22m;',s)
s=re.sub(r'\s*proxy_set_header\s+(?:Host|X-Forwarded-Proto|X-Forwarded-For)\s+[^;]+;', '', s)
s,count=re.subn(r'(proxy_pass\s+http://(?:localhost|127\.0\.0\.1):4000[^;]*;)',r'\1\n        proxy_set_header Host $host;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_set_header X-Forwarded-For $remote_addr;',s)
if count < 1: raise SystemExit('Не найден ожидаемый proxy_pass API; конфигурация не изменена')
p.write_text(s)
CONFIG
nginx -t
cat > /etc/systemd/system/karlo-wear-api.service <<'SERVICE'
[Unit]
Description=Karlo Wear API
After=network.target
[Service]
Type=simple
User=karlo-wear
Group=karlo-wear
WorkingDirectory=/srv/karlo-wear/current/server
ExecStart=/usr/bin/node dist/index.js
Environment=NODE_ENV=production
Environment=TZ=Europe/Moscow
Environment=HOST=127.0.0.1
Restart=on-failure
RestartSec=3
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/srv/karlo-wear/shared/uploads /srv/karlo-wear/shared/private
[Install]
WantedBy=multi-user.target
SERVICE
ln -sfn "$release" "$base/current"
switched=true
systemctl daemon-reload
systemctl enable --now karlo-wear-api.service
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 1 --max-time 5 http://127.0.0.1:4000/api/ready
cp -a client/dist/assets/. /var/www/karlo-wear/assets/
install -m 644 client/dist/index.html /var/www/karlo-wear/index.html.new
mv /var/www/karlo-wear/index.html.new /var/www/karlo-wear/index.html
systemctl reload nginx
cat > /etc/systemd/system/karlo-wear-backup.service <<'SERVICE'
[Unit]
Description=Karlo Wear database and media backup
[Service]
Type=oneshot
WorkingDirectory=/srv/karlo-wear/current
UMask=0077
ExecStart=/usr/bin/node scripts/backup-db.mjs
ExecStart=/bin/sh -c '/bin/tar -czf /var/backups/karlo-wear/media-$(/bin/date +%%Y%%m%%d).tar.gz -C /srv/karlo-wear/shared uploads private'
ExecStart=/usr/bin/node scripts/maintenance.mjs
SERVICE
cat > /etc/systemd/system/karlo-wear-backup.timer <<'TIMER'
[Unit]
Description=Daily Karlo Wear backup
[Timer]
OnCalendar=*-*-* 04:00:00 Europe/Moscow
RandomizedDelaySec=600
Persistent=true
[Install]
WantedBy=timers.target
TIMER
systemctl daemon-reload
systemctl enable --now karlo-wear-backup.timer
systemctl start karlo-wear-backup.service
if command -v pm2 >/dev/null; then pm2 delete karlo-wear-api || true; pm2 save --force || true; fi
stopped=false
trap - EXIT
echo
echo "Установлено. Проверенная копия базы: $backup/database.dump"
echo 'API работает через systemd от отдельного пользователя; порт 4000 слушает только localhost.'
echo 'Админка потребует повторного входа. Старые заказы доступны по новой ссылке из админки.'
echo 'Ежедневные копии: /var/backups/karlo-wear. Для защиты от потери VPS перенесите их во внешнее хранилище.'
systemctl --no-pager --full status karlo-wear-api.service
