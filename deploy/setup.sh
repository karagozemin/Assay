#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Assay — one-shot provisioner for a fresh Ubuntu 22.04/24.04 DigitalOcean Droplet.
# Docker-free: installs Node 22, Python 3, nginx, and wires up three systemd
# services behind an nginx reverse proxy — the WHOLE app on one Droplet, one origin.
#
#   /        → web      (Next.js,  127.0.0.1:3000)
#   /api/*   → backend  (Express,  127.0.0.1:4000)
#   /agent/* → agent    (FastAPI,  127.0.0.1:8000)

#
# Run as root on the Droplet:
#     curl -fsSL https://raw.githubusercontent.com/karagozemin/Assay/main/deploy/setup.sh | bash
#   or, after cloning:
#     sudo bash deploy/setup.sh
#
# Idempotent: safe to re-run to pull latest code and restart services.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/karagozemin/Assay.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="/opt/assay"
DATA_DIR="${APP_DIR}/data"
APP_USER="assay"

say() { printf "\n\033[1;35m▶ %s\033[0m\n" "$*"; }

if [[ $EUID -ne 0 ]]; then echo "Run as root (sudo bash deploy/setup.sh)"; exit 1; fi

# ── 1. System packages ──────────────────────────────────────────────────────
say "Installing base packages (git, nginx, python3, build tools)…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git nginx python3 python3-venv python3-pip curl ca-certificates

# ── 2. Node 22 (NodeSource) ─────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -c2-3)" -lt 22 ]]; then
  say "Installing Node.js 22…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
say "Node $(node -v), npm $(npm -v)"

# ── 3. App user + directories ───────────────────────────────────────────────
if ! id "$APP_USER" >/dev/null 2>&1; then
  say "Creating service user '$APP_USER'…"
  useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
fi
# ── 4. Clone or update the repo ─────────────────────────────────────────────
# NOTE: do NOT pre-create $APP_DIR here — `git clone` requires the target to be
# empty/absent. The data dir (which lives outside the repo) is created AFTER.
if [[ -d "${APP_DIR}/.git" ]]; then
  say "Updating existing checkout…"
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/${BRANCH}"
else
  say "Cloning ${REPO_URL} (${BRANCH})…"
  rm -rf "$APP_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

# Persistent data dir (SQLite ledger) — created after checkout so it never
# blocks the clone above.
mkdir -p "$DATA_DIR"


# ── 5. Backend deps (npm ci runs patch-package via postinstall) ─────────────
say "Installing backend dependencies…"
( cd "${APP_DIR}/backend" && npm ci )

if [[ ! -f "${APP_DIR}/backend/.env.local" ]]; then
  cp "${APP_DIR}/backend/.env.example" "${APP_DIR}/backend/.env.local"
  say "!! Created backend/.env.local from the example — EDIT IT with real testnet keys:"
  say "     nano ${APP_DIR}/backend/.env.local"
fi

# ── 6. Agent virtualenv ─────────────────────────────────────────────────────
say "Setting up the Python agent virtualenv…"
python3 -m venv "${APP_DIR}/agent/.venv"
"${APP_DIR}/agent/.venv/bin/pip" install --upgrade pip
"${APP_DIR}/agent/.venv/bin/pip" install -r "${APP_DIR}/agent/requirements.txt"

# ── 7. Web app (Next.js) — same-origin build so no domain/CORS needed ───────
say "Building the web app (same-origin /api and /agent)…"
( cd "${APP_DIR}/web" \
  && npm ci \
  && NEXT_PUBLIC_BACKEND_URL=/api NEXT_PUBLIC_AGENT_URL=/agent npm run build )

# ── 8. Ownership ────────────────────────────────────────────────────────────
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# ── 9. systemd services ─────────────────────────────────────────────────────
say "Installing systemd units…"
cp "${APP_DIR}/deploy/assay-backend.service" /etc/systemd/system/assay-backend.service
cp "${APP_DIR}/deploy/assay-agent.service"   /etc/systemd/system/assay-agent.service
cp "${APP_DIR}/deploy/assay-web.service"     /etc/systemd/system/assay-web.service
systemctl daemon-reload
systemctl enable --now assay-backend.service
systemctl enable --now assay-agent.service
systemctl enable --now assay-web.service


# ── 10. nginx reverse proxy ─────────────────────────────────────────────────

say "Configuring nginx…"
cp "${APP_DIR}/deploy/nginx.conf" /etc/nginx/sites-available/assay
ln -sf /etc/nginx/sites-available/assay /etc/nginx/sites-enabled/assay
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ── 11. Done ────────────────────────────────────────────────────────────────
IP="$(curl -fsSL ifconfig.me || echo YOUR_DROPLET_IP)"
say "Done. Assay is live on ONE box:"
cat <<EOF

  App (UI):  http://${IP}/          ← open this in your browser
  Health:    http://${IP}/healthz
  Backend:   http://${IP}/api/health
  Agent:     http://${IP}/agent/health

  Next steps:
    1) Edit real testnet keys:  nano ${APP_DIR}/backend/.env.local
       then: systemctl restart assay-backend
    2) (optional) Seed demo sources:  see deploy/README.md

  Logs:  journalctl -u assay-web     -f
         journalctl -u assay-backend -f
         journalctl -u assay-agent   -f
EOF

