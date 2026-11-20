#!/usr/bin/env bash
# Run only on the new Ubuntu 24.04 x86_64 EC2 instance, with sudo.
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo 'Run with sudo.' >&2; exit 1; fi
. /etc/os-release
if [[ $ID != ubuntu || $VERSION_ID != 24.04 || $(uname -m) != x86_64 ]]; then
  echo 'This installer requires Ubuntu 24.04 x86_64.' >&2; exit 1
fi
apt-get update
apt-get install -y ca-certificates curl gnupg git xz-utils openssl postgresql-client-16 debian-keyring debian-archive-keyring apt-transport-https
# Node.js official Linux distribution; verify its SHA-256 checksum before extracting.
workdir=$(mktemp -d)
trap 'rm -rf -- "$workdir"' EXIT
cd "$workdir"
base=https://nodejs.org/dist/latest-v22.x
curl -fsSLO "$base/SHASUMS256.txt"
archive=$(awk '$2 ~ /^node-v22\.[0-9]+\.[0-9]+-linux-x64\.tar\.xz$/ { print $2 }' SHASUMS256.txt)
if [[ -z $archive || $archive == *$'\n'* ]]; then echo 'Could not identify the Node 22 archive.' >&2; exit 1; fi
curl -fsSLO "$base/$archive"
grep -F "  $archive" SHASUMS256.txt | sha256sum --check -
mkdir -p /opt
tar -xJf "$archive" -C /opt
release=${archive%.tar.xz}
ln -sfn "/opt/$release/bin/node" /usr/local/bin/node
ln -sfn "/opt/$release/bin/npm" /usr/local/bin/npm
ln -sfn "/opt/$release/bin/npx" /usr/local/bin/npx
# Caddy's official stable apt repository and native systemd service.
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
chmod 644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy
systemctl stop caddy
if ! id shopsmart >/dev/null 2>&1; then useradd --system --user-group --create-home --home-dir /var/lib/shopsmart --shell /usr/sbin/nologin shopsmart; fi
install -d -o root -g shopsmart -m 0750 /etc/shopsmart
/usr/local/bin/node --version
/usr/local/bin/npm --version
caddy version

# Trust AWS RDS certificates for verified TLS connections.
curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /etc/shopsmart/rds-ca.pem
chown root:shopsmart /etc/shopsmart/rds-ca.pem
chmod 640 /etc/shopsmart/rds-ca.pem
