#!/usr/bin/env sh
# Sourced by start-test-server.sh. Install only this server's runtime, never upgrade the host globally.
runtime_log() { printf '[SkyMP] %s\n' "$*" >&2; }
valid_node() {
  [ -x "$1" ] || return 1
  "$1" -e 'if (+process.versions.node.split(".")[0] < 22 || process.arch !== "x64") process.exit(1)' >/dev/null 2>&1
}
runtime_packages() {
  [ "$#" -gt 0 ] || return 0
  runtime_log "Installiere benoetigte Systempakete: $*"
  if [ "$(id -u)" -eq 0 ]; then
    if command -v apt-get >/dev/null 2>&1; then
      apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "$@"
    else
      runtime_log 'Automatische Systempakete sind fuer Ubuntu/Debian verfuegbar. Bitte curl, ca-certificates, tar, gzip, libstdc++ und libgcc bereitstellen.'; return 1
    fi
  elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo -n apt-get update && sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "$@"
  else
    runtime_log "Fuer fehlende Systempakete einmal mit passenden Administratorrechten starten: sudo sh ./start-test-server.sh"; return 1
  fi
}
runtime_fetch() {
  if command -v curl >/dev/null 2>&1; then
    curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --tlsv1.2 --connect-timeout 15 --max-time 180 --retry 2 "$1" -o "$2"
  else
    wget --https-only --timeout=60 --tries=2 -q -O "$2" "$1"
  fi
}
ensure_runtime() {
  [ "$(uname -s)" = Linux ] && [ "$(uname -m)" = x86_64 ] || { runtime_log 'Dieses Paket benoetigt Linux x86_64 mit glibc.'; return 1; }
  runtime_root="$(pwd -P)/.runtime"
  [ ! -L "$runtime_root" ] || { runtime_log '.runtime darf kein symbolischer Link sein.'; return 1; }
  SKYMP_NODE=''
  runtime_current=''
  if [ -f "$runtime_root/node-path.txt" ]; then
    runtime_name=$(cat "$runtime_root/node-path.txt")
    case "$runtime_name" in node-v22.*-linux-x64) case "$runtime_name" in *[!a-zA-Z0-9.-]*) ;; *) runtime_current="$runtime_root/$runtime_name/bin/node" ;; esac ;; esac
    if ! valid_node "$runtime_current"; then runtime_current=''; fi
  fi
  if [ -z "$runtime_current" ] && [ "${SKYMP_MANAGED_NODE:-0}" != 1 ]; then
    runtime_system=$(command -v node || true)
    if valid_node "$runtime_system"; then SKYMP_NODE="$runtime_system"; fi
  fi
  # The ELF module needs these libraries even when Node is already installed.
  runtime_missing=''
  if command -v ldd >/dev/null 2>&1 && [ -f scam_native.node ]; then
    runtime_ldd=$(ldd ./scam_native.node 2>&1 || true)
    case "$runtime_ldd" in *'libstdc++.so.6 => not found'*) runtime_missing="$runtime_missing libstdc++6" ;; esac
    case "$runtime_ldd" in *'libgcc_s.so.1 => not found'*) runtime_missing="$runtime_missing libgcc-s1" ;; esac
  fi
  if [ -z "$SKYMP_NODE" ] && [ "${SKYMP_RUNTIME_OFFLINE:-0}" != 1 ]; then
    command -v curl >/dev/null 2>&1 || command -v wget >/dev/null 2>&1 || runtime_missing="$runtime_missing curl"
    [ -s /etc/ssl/certs/ca-certificates.crt ] || runtime_missing="$runtime_missing ca-certificates"
    command -v tar >/dev/null 2>&1 || runtime_missing="$runtime_missing tar"
    command -v gzip >/dev/null 2>&1 || runtime_missing="$runtime_missing gzip"
    command -v sha256sum >/dev/null 2>&1 || runtime_missing="$runtime_missing coreutils"
  fi
  # This is a fixed package allowlist, not user or network input.
  if [ -n "$runtime_missing" ]; then runtime_packages $runtime_missing || return 1; fi
  if [ -n "$SKYMP_NODE" ]; then export SKYMP_NODE; return 0; fi
  if [ "${SKYMP_RUNTIME_OFFLINE:-0}" = 1 ]; then
    [ -n "$runtime_current" ] || { runtime_log 'Offline-Start: keine passende Node.js-Laufzeit vorhanden.'; return 1; }
    SKYMP_NODE="$runtime_current"; export SKYMP_NODE; return 0
  fi
  mkdir -p "$runtime_root"
  runtime_now=$(date +%s)
  runtime_checked=$(cat "$runtime_root/checked-at.txt" 2>/dev/null || printf 0)
  case "$runtime_checked" in ''|*[!0-9]*) runtime_checked=0 ;; esac
  if [ -n "$runtime_current" ] && [ "$((runtime_now - runtime_checked))" -ge 0 ] && [ "$((runtime_now - runtime_checked))" -lt 86400 ]; then
    SKYMP_NODE="$runtime_current"; export SKYMP_NODE; return 0
  fi
  runtime_stage=$(mktemp -d "$runtime_root/staging.XXXXXXXX") || {
    [ -n "$runtime_current" ] || return 1
    runtime_log 'Kein Schreibzugriff fuer ein Laufzeitupdate; vorhandene Laufzeit bleibt aktiv.'
    SKYMP_NODE="$runtime_current"; export SKYMP_NODE; return 0
  }
  runtime_ok=0
  runtime_log 'Pruefe die aktuelle Node.js-22-LTS-Laufzeit bei nodejs.org ...'
  if runtime_fetch 'https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt' "$runtime_stage/SHASUMS256.txt"; then
    runtime_entry=$(awk '$1 ~ /^[0-9a-f]+$/ && length($1)==64 && $2 ~ /^node-v22\.[0-9]+\.[0-9]+-linux-x64\.tar\.gz$/ { print $1 " " $2; exit }' "$runtime_stage/SHASUMS256.txt")
    runtime_hash=${runtime_entry%% *}; runtime_archive=${runtime_entry#* }
    if [ -n "$runtime_entry" ]; then
      runtime_folder=${runtime_archive%.tar.gz}
      runtime_version=${runtime_folder#node-}; runtime_version=${runtime_version%-linux-x64}
      if [ -n "$runtime_current" ] && [ "$runtime_current" = "$runtime_root/$runtime_folder/bin/node" ]; then
        runtime_ok=1
      elif runtime_fetch "https://nodejs.org/dist/$runtime_version/$runtime_archive" "$runtime_stage/$runtime_archive" &&
           (cd "$runtime_stage" && printf '%s  %s\n' "$runtime_hash" "$runtime_archive" | sha256sum -c -) &&
           tar -xzf "$runtime_stage/$runtime_archive" -C "$runtime_stage" "$runtime_folder/bin/node" "$runtime_folder/LICENSE" && valid_node "$runtime_stage/$runtime_folder/bin/node"; then
        # Never overwrite a running or partially installed version.
        if [ ! -e "$runtime_root/$runtime_folder" ]; then mv "$runtime_stage/$runtime_folder" "$runtime_root/$runtime_folder"; fi
        if valid_node "$runtime_root/$runtime_folder/bin/node"; then
          printf '%s\n' "$runtime_folder" > "$runtime_stage/node-path.txt"
          mv "$runtime_stage/node-path.txt" "$runtime_root/node-path.txt"
          runtime_current="$runtime_root/$runtime_folder/bin/node"; runtime_ok=1
        fi
      fi
    fi
  fi
  if [ "$runtime_ok" = 1 ]; then printf '%s\n' "$runtime_now" > "$runtime_root/checked-at.txt"; fi
  # Both paths are inside the physical server directory; never follow a runtime symlink.
  case "$runtime_stage" in "$runtime_root"/staging.*) [ ! -L "$runtime_stage" ] && rm -rf -- "$runtime_stage" ;; esac
  if [ -z "$runtime_current" ]; then runtime_log 'Node.js konnte nicht sicher heruntergeladen/installiert werden. Netzwerk und nodejs.org pruefen.'; return 1; fi
  [ "$runtime_ok" = 1 ] || runtime_log 'Update nicht verfuegbar; die vorhandene gepruefte Laufzeit wird weiterverwendet.'
  SKYMP_NODE="$runtime_current"; export SKYMP_NODE
}
