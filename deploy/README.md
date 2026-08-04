# Deploy — Ubuntu 24.04 (PM2 + Nginx)

Automates `DEPLOYMENT_BACKEND.md` + `DEPLOYMENT_FRONTEND.md` into one script.

## 1. Prep the `.env` files (secrets — not done by the script)

Fill in production values, especially the URLs:

- `backend/.env` → `FRONTEND_URL=https://<domain>`, `ENVIRONMENT=production`
- `frontend/.env` → `NEXTAUTH_URL=https://<domain>`, `NEXT_PUBLIC_API_URL=https://<domain>` (base URL, no `/api` — the code appends it)

## 2. Run

```bash
git clone <repo> && cd <repo>
DOMAIN=pmb.haloiti.com sudo -E bash deploy/setup.sh
```

Point the domain's DNS A record at the VPS first, or Certbot (step 7) fails.
Skip HTTPS with `SKIP_CERTBOT=1` (e.g. testing over plain IP/HTTP).

## 3. Manage

```bash
pm2 status                 # both apps green?
pm2 logs pmb-backend       # live backend logs
pm2 restart pmb-backend    # after editing code or .env
```

Re-running `setup.sh` is safe (idempotent) — use it to redeploy after `git pull`.

## Files
- `setup.sh` — the bootstrap (system deps → venv → build → PM2 → Nginx → Certbot)
- `ecosystem.config.js` — PM2 process definitions (backend :8000, frontend :3000)
- `nginx-pmb.conf.template` — reverse proxy; `{{DOMAIN}}` filled in by the script
