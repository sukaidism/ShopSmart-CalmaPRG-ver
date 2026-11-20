#!/usr/bin/env bash
# Update the already-pulled code. Back up RDS and record the old SHA before use.
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo 'Run with sudo.' >&2; exit 1; fi
cd /opt/shopsmart
[[ -f /etc/shopsmart/backend.env ]] || { echo 'Run first-time setup first.' >&2; exit 1; }
systemctl stop caddy shopsmart
runuser -u ubuntu -- /usr/local/bin/npm ci
runuser -u ubuntu -- /usr/local/bin/npm run db:generate
runuser -u shopsmart -- bash deploy/aws/run-backend.sh /usr/local/bin/npx prisma migrate deploy
runuser -u ubuntu -- env VITE_API_URL=/api /usr/local/bin/npm run build
cp -a frontend/dist/. /srv/shopsmart/
chmod -R a+rX /srv/shopsmart
install -o root -g root -m 644 deploy/aws/shopsmart.service /etc/systemd/system/shopsmart.service
systemctl daemon-reload
systemctl restart shopsmart
systemctl start caddy
