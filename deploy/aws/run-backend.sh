#!/usr/bin/env bash
# Run as the shopsmart service identity; never prints the environment.
set -euo pipefail
if [[ $(id -un) != shopsmart ]]; then echo 'Run with sudo -u shopsmart bash deploy/aws/run-backend.sh COMMAND...' >&2; exit 1; fi
if [[ $# -eq 0 ]]; then echo 'Supply the backend command.' >&2; exit 1; fi
set -a
source /etc/shopsmart/backend.env
set +a
export PATH=/usr/local/bin:/usr/bin:/bin
cd /opt/shopsmart/backend
exec "$@"
