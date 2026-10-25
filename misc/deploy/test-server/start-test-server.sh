#!/usr/bin/env sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. ./bootstrap-runtime.sh
ensure_runtime
PATH="$(dirname -- "$SKYMP_NODE"):$PATH"
export PATH
if [ "${SKYMP_RUNTIME_CHECK_ONLY:-0}" = 1 ]; then printf '%s\n' "$SKYMP_NODE"; exit 0; fi
"$SKYMP_NODE" setup-server.cjs --ensure
"$SKYMP_NODE" check-install.cjs
exec "$SKYMP_NODE" server-supervisor.cjs "$@"
