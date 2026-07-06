# Deploying Assay (Docker-free) on a single DigitalOcean Droplet

The **whole app** — web UI, backend, and agent — runs on **one small Ubuntu
Droplet** as three `systemd` services behind **nginx**. Everything is served from
**one origin** (`http://<DROPLET_IP>/`), so there is **no CORS, no mixed-content,
and no domain required**. The SQLite ledger persists on the box's disk. No Docker.

```
Browser ──► nginx :80  (Droplet)
              ├── /        → 127.0.0.1:3000  web     (Next.js UI)
              ├── /api/*   → 127.0.0.1:4000  backend (registry, ledger, x402 payments)
              └── /agent/* → 127.0.0.1:8000  agent   (POST /run → SSE decision stream)
```

Because the browser loads the page from the same `http://<IP>` that serves `/api`
and `/agent`, the calls are same-origin plain http — the **"Failed to fetch" /
mixed-content** problem simply cannot happen.

---

## 1. Create the Droplet

- **Basic / Regular**, Ubuntu 24.04, the cheapest shared-CPU size is plenty.
- Add your SSH key. Note the public IP.

## 2. Provision it (one command)

SSH in as root and run the bootstrap script straight from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/karagozemin/Assay/main/deploy/setup.sh | bash
```

This installs Node 22, Python 3, nginx; clones the repo to `/opt/assay`; installs
deps; **builds the web app with same-origin `/api` and `/agent` paths**; creates
the `assay-web`, `assay-backend`, and `assay-agent` systemd services; and wires up
the nginx reverse proxy. It is **idempotent** — re-run it any time to pull the
latest `main`, rebuild, and restart.

> Prefer to inspect first? `git clone` the repo and run `sudo bash deploy/setup.sh`.

## 3. Add your real testnet secrets

The script created `/opt/assay/backend/.env.local` from the example. Fill in a
**funded Arc-testnet** buyer wallet (and a creator wallet for seeded payouts):

```bash
nano /opt/assay/backend/.env.local
# BUYER_ADDRESS / BUYER_PRIVATE_KEY  → funded testnet wallet
# CREATOR_ADDRESS / CREATOR_PRIVATE_KEY
systemctl restart assay-backend
```

> `ASSAY_DB` and `PORT` are set by the systemd unit (DB persists in
> `/opt/assay/data/assay.sqlite`, outside the repo), so leave those out of
> `.env.local` or they'll be overridden.

## 4. Verify

Open **`http://<DROPLET_IP>/`** in your browser — that's the app. Or from the CLI:

```bash
curl http://<DROPLET_IP>/healthz          # nginx edge
curl http://<DROPLET_IP>/api/health       # backend  → {"ok":true,...}
curl http://<DROPLET_IP>/agent/health     # agent    → {"status":"ok",...}
```

Logs:

```bash
journalctl -u assay-web     -f
journalctl -u assay-backend -f
journalctl -u assay-agent   -f
```

## 5. (Optional) Seed demo sources

The `scripts/seed.py` helper registers demo creators + sources against the running
backend so the discover/assay flow has content:

```bash
cd /opt/assay
ASSAY_BACKEND_URL=http://127.0.0.1:4000 agent/.venv/bin/python scripts/seed.py
```

---

## (Optional) Add a domain + HTTPS

Not required — the single-origin http setup works on the bare IP. But if you want a
nice URL and a padlock:

1. Point a DNS `A` record (e.g. `assay.yourdomain.com`) at the Droplet IP.
2. On the Droplet:
   ```bash
   apt-get install -y certbot python3-certbot-nginx
   # set server_name in /etc/nginx/sites-available/assay to your domain first
   certbot --nginx -d assay.yourdomain.com
   ```

Since the web build already uses **relative** `/api` and `/agent` paths, TLS
"just works" after certbot — no rebuild or env changes needed.

---

## Redeploying after code changes

```bash
ssh root@<DROPLET_IP> 'bash -lc "curl -fsSL https://raw.githubusercontent.com/karagozemin/Assay/main/deploy/setup.sh | bash"'
```

The re-run pulls latest `main`, rebuilds the web app, and restarts all three
services.

## Files in this folder

| File | Purpose |
|------|---------|
| `setup.sh` | One-shot provisioner (Node/Python/nginx + systemd + clone + web build). |
| `assay-web.service` | systemd unit for the Next.js web app (port 3000). |
| `assay-backend.service` | systemd unit for the Express backend (port 4000). |
| `assay-agent.service` | systemd unit for the FastAPI agent (port 8000). |
| `nginx.conf` | Reverse proxy: `/` → web, `/api/*` → backend, `/agent/*` → agent (SSE-safe). |
