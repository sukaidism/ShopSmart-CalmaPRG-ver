#!/usr/bin/env bash
# First deployment only. Run with sudo on the new EC2 host from /opt/shopsmart.
set -euo pipefail
umask 077
if [[ $EUID -ne 0 ]]; then echo 'Run with sudo.' >&2; exit 1; fi
repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
if [[ $repo != /opt/shopsmart ]]; then echo 'Clone the release to /opt/shopsmart first.' >&2; exit 1; fi
if [[ -e /etc/shopsmart/backend.env ]]; then echo 'Server settings already exist. Use deploy/aws/update.sh for an existing deployment.' >&2; exit 1; fi
read -r -p 'Public hostname (for example shopsmart-name.duckdns.org): ' site_domain
read -r -p 'Certificate contact email: ' acme_email
read -r -p 'DatabaseEndpoint from CloudFormation Outputs: ' rds_endpoint
read -r -s -p 'RDS administrator password (the 64 hex characters supplied to the stack): ' rds_password
printf '\n'
[[ $site_domain =~ ^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$ ]] || { echo 'Enter a valid lowercase public hostname, without https:// or a path.' >&2; exit 1; }
[[ $acme_email =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || { echo 'Enter a valid contact email.' >&2; exit 1; }
[[ $rds_endpoint =~ ^[A-Za-z0-9.-]+\.rds\.amazonaws\.com$ ]] || { echo 'Enter the actual RDS endpoint hostname.' >&2; exit 1; }
[[ $rds_password =~ ^[a-fA-F0-9]{64}$ ]] || { echo 'Expected the 64-character hexadecimal stack password.' >&2; exit 1; }
bash "$repo/deploy/aws/install-runtime.sh"
cd "$repo"
# Dependencies must be readable by the shopsmart service user; the script-wide umask 077 is only for secrets.
(
  umask 022
  runuser -u ubuntu -- /usr/local/bin/npm ci
  runuser -u ubuntu -- /usr/local/bin/npm run db:generate
)
chmod -R a+rX /opt/shopsmart
# The app uses an ordinary DB role; administrator credentials are not saved on EC2.
app_password=$(openssl rand -hex 32)
PGPASSWORD="$rds_password" psql "host=$rds_endpoint port=5432 user=shopsmart_admin dbname=shopsmart sslmode=verify-full sslrootcert=/etc/shopsmart/rds-ca.pem" -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
CREATE ROLE shopsmart LOGIN PASSWORD '$app_password';
GRANT CONNECT ON DATABASE shopsmart TO shopsmart;
GRANT USAGE, CREATE ON SCHEMA public TO shopsmart;
COMMIT;
SQL
unset rds_password
cat > /etc/shopsmart/backend.env <<EOF
DATABASE_URL='postgresql://shopsmart:$app_password@$rds_endpoint:5432/shopsmart?schema=public&sslmode=require&sslcert=/etc/shopsmart/rds-ca.pem&sslaccept=strict&connection_limit=5'
HOST=127.0.0.1
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://$site_domain
TRUST_PROXY=loopback
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
EOF
unset app_password
chown root:shopsmart /etc/shopsmart/backend.env
chmod 640 /etc/shopsmart/backend.env
cat > /etc/caddy/shopsmart.env <<EOF
SITE_DOMAIN=$site_domain
ACME_EMAIL=$acme_email
EOF
chown root:caddy /etc/caddy/shopsmart.env
chmod 640 /etc/caddy/shopsmart.env
runuser -u shopsmart -- bash deploy/aws/run-backend.sh /usr/local/bin/npx prisma migrate deploy
# Initialize only when there are no catalog or order records; never reset deployed data.
runuser -u shopsmart -- bash deploy/aws/run-backend.sh /usr/local/bin/node prisma/seed-empty.js
runuser -u ubuntu -- env VITE_API_URL=/api /usr/local/bin/npm run build
install -d -o root -g root -m 755 /srv/shopsmart
cp -a frontend/dist/. /srv/shopsmart/
chmod -R a+rX /srv/shopsmart
install -o root -g root -m 644 deploy/aws/shopsmart.service /etc/systemd/system/shopsmart.service
install -d -m 755 /etc/systemd/system/caddy.service.d
install -o root -g root -m 644 deploy/aws/caddy-override.conf /etc/systemd/system/caddy.service.d/shopsmart.conf
install -o root -g root -m 644 deploy/aws/Caddyfile /etc/caddy/Caddyfile
set -a
source /etc/caddy/shopsmart.env
set +a
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl daemon-reload
systemctl enable --now shopsmart caddy
curl --fail --retry 10 --retry-connrefused --retry-delay 2 http://127.0.0.1:3000/api/products >/dev/null
printf 'App configured. Check https://%s after certificate issuance.\n' "$site_domain"
echo 'Capture hosted acceptance evidence before claiming the release is deployed.'
