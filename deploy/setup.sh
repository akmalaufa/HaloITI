#!/usr/bin/env bash
# Idempotent deploy bootstrap for HaloITI / PMB ITI on Ubuntu 24.04.
# Automates DEPLOYMENT_BACKEND.md + DEPLOYMENT_FRONTEND.md (PM2 + Nginx + Certbot).
#
# Usage (from the repo root):
#   DOMAIN=pmb.haloiti.com sudo -E bash deploy/setup.sh
#   DOMAIN=pmb.haloiti.com SKIP_CERTBOT=1 sudo -E bash deploy/setup.sh
#
# Prereqs: backend/.env and frontend/.env already filled in with production values
# (this script never touches your secrets).
set -euo pipefail

DOMAIN="${DOMAIN:-}"
SKIP_CERTBOT="${SKIP_CERTBOT:-0}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_USER="${SUDO_USER:-$USER}"   # the human, not root — PM2 runs under this user

log() { echo -e "\n\033[1;32m==> $*\033[0m"; }
die() { echo -e "\033[1;31mERROR: $*\033[0m" >&2; exit 1; }

[[ -n "$DOMAIN" ]] || die "Set DOMAIN, e.g. DOMAIN=pmb.haloiti.com sudo -E bash deploy/setup.sh"
[[ $EUID -eq 0 ]] || die "Run with sudo (needs apt + nginx). Use: sudo -E bash deploy/setup.sh"
[[ -f "$REPO_ROOT/backend/.env" ]]  || die "backend/.env missing — create it first (see DEPLOYMENT_BACKEND.md)"
[[ -f "$REPO_ROOT/frontend/.env" ]] || die "frontend/.env missing — create it first (see DEPLOYMENT_FRONTEND.md)"

# run a command as the invoking user (not root) so venv/node_modules/pm2 aren't root-owned
as_user() { sudo -u "$RUN_USER" -H bash -lc "$*"; }

log "1/7 System packages"
apt-get update -y
apt-get install -y python3 python3-venv python3-pip git curl nginx

log "2/7 Node.js 20 + PM2"
if ! command -v node >/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2

log "3/7 Backend venv + deps"
# /var/www is root-owned by default; make the repo user-owned so venv/pip run without sudo
chown -R "$RUN_USER":"$RUN_USER" "$REPO_ROOT"
as_user "cd '$REPO_ROOT/backend' && python3 -m venv venv && \
  ./venv/bin/pip install --upgrade pip -q && \
  ./venv/bin/pip install -r requirements.txt"

log "4/7 Frontend install + build"
as_user "cd '$REPO_ROOT/frontend' && npm install && npm run build"

log "5/7 PM2 start both apps"
as_user "cd '$REPO_ROOT' && pm2 startOrReload deploy/ecosystem.config.js && pm2 save"
# enable PM2 auto-start on boot for the invoking user
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$RUN_USER" --hp "/home/$RUN_USER" | tail -1 | bash || true

log "6/7 Nginx reverse proxy"
sed "s/{{DOMAIN}}/$DOMAIN/g" "$REPO_ROOT/deploy/nginx-pmb.conf.template" > /etc/nginx/sites-available/pmb
ln -sf /etc/nginx/sites-available/pmb /etc/nginx/sites-enabled/pmb
[[ -e /etc/nginx/sites-enabled/default ]] && rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

log "7/7 HTTPS (Certbot)"
if [[ "$SKIP_CERTBOT" == "1" ]]; then
  echo "Skipped (SKIP_CERTBOT=1). Site live at http://$DOMAIN"
else
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect \
    || echo "Certbot failed — run manually: sudo certbot --nginx -d $DOMAIN"
fi

log "Done. Check: pm2 status  |  https://$DOMAIN"
