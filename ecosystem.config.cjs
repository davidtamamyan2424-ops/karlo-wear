// PM2 configuration for the production API.
// Run from the repository root: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "karlo-wear-api",
    cwd: "/root/karlo-wear/server",
    script: "dist/index.js",
    exec_mode: "fork",
    instances: 1,
    autorestart: true,
    restart_delay: 5000,
    min_uptime: "10s",
    max_restarts: 20,
    max_memory_restart: "500M",
    env: { NODE_ENV: "production", PORT: "4000" }
  }]
};
