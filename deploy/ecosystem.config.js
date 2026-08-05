// PM2 process definitions for HaloITI / PMB ITI (Ubuntu 24.04).
// Run from the repo root: pm2 start deploy/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "pmb-backend",
      cwd: "./backend",
      script: "./venv/bin/uvicorn",
      args: "app.main:app --host 127.0.0.1 --port 8001 --proxy-headers",
      interpreter: "none", // uvicorn is already a native executable inside the venv
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: "pmb-frontend",
      cwd: "./frontend",
      script: "npm",
      args: "run start", // serves the pre-built .next; port di-set via -p di package.json
      interpreter: "none",

      autorestart: true,
      max_restarts: 10,
    },
  ],
};
