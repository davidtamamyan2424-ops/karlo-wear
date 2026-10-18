# KARLO WEAR: PM2 auto-start and health check (Ubuntu VPS)

The repository contains the PM2 process definition, but **adding these files does not configure the VPS**. Follow this runbook once on the live server after reviewing it. It assumes the existing deployment is at `/root/karlo-wear`, the API uses port 4000, and PM2 runs as root.

## Connect

```bash
ssh root@159.194.229.19
```

## Inspect first (read-only)

```bash
pm2 list
pm2 show karlo-wear-api
systemctl is-enabled pm2-root || true
curl -fsS --max-time 10 http://127.0.0.1:4000/api/health
curl -fsS --max-time 15 http://127.0.0.1:4000/api/products >/dev/null
```

Do not replace a healthy running PM2 process just to apply this config. Confirm the deployed files and environment match the repository before adopting the ecosystem file. **Never run `prisma:seed` on production**; the seed script clears/repopulates demo data.

## Enable boot recovery without restarting the healthy API

```bash
# PM2 must show karlo-wear-api as online before saving.
pm2 save
pm2 startup systemd -u root --hp /root
systemctl is-enabled pm2-root
systemctl status pm2-root --no-pager
```

If `pm2 startup` prints a command to execute, run that exact command as instructed. Then `pm2 save` again. `pm2 save` alone does not enable systemd startup. Do not reboot production just to test this.

## Optional: adopt the versioned PM2 configuration during a maintenance window

Only after the repository changes have been deployed to `/root/karlo-wear`, confirm `server/dist/index.js` exists and `server/.env` contains production settings. Because replacing the PM2 entry briefly interrupts the API, schedule downtime:

```bash
cd /root/karlo-wear
pm2 delete karlo-wear-api
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
bash ops/check-api.sh
```

The PM2 process uses `cwd=/root/karlo-wear/server` so dotenv loads `server/.env`. The ecosystem configuration specifies automatic restart after crashes, restart delay and a memory ceiling. PM2's systemd unit restores saved processes after reboot.

## Diagnose an outage

```bash
pm2 status
pm2 logs karlo-wear-api --lines 100 --nostream
systemctl status pm2-root --no-pager
journalctl -u pm2-root -n 100 --no-pager
curl -i --max-time 10 http://127.0.0.1:4000/api/health
curl -i --max-time 15 http://127.0.0.1:4000/api/products
```

The `/api/health` route only checks the Express process. The catalog check also exercises the products endpoint and therefore provides a stronger signal of store availability. These checks do not send notifications or restart the server.

## Disconnect

```bash
exit
```
