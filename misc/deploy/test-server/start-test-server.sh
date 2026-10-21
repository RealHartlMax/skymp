#!/usr/bin/env sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
command -v node >/dev/null 2>&1 || { echo 'Node.js 22 oder neuer fehlt. Siehe README-TEST.md.' >&2; exit 1; }
node setup-server.cjs --ensure
node check-install.cjs
exec node dist_back/skymp5-server.js "$@"
