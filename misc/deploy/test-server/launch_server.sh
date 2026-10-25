#!/usr/bin/env sh
exec sh "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/start-test-server.sh" "$@"
