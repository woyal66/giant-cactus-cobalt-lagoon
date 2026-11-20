#!/bin/sh
set -eu
cd /workspace
# :8081 is QA-only — a revive must never inherit a stale built-output preview.
# Called directly, not via npm: no node_modules needed, so nothing to wait for.
node scripts/preview.mjs stop || true

# A server reparented to init still answers on :8080, but the preview proxy
# will not attach to it. Only a process in this session's tree counts.
# readlink on another user's fds fails, so a busy port we cannot identify
# is treated as not ours and stopped.
session_owns_port() {
  inode=$(awk '$2 ~ /:1F90$/ && $4 == "0A" { print $10; exit }' /proc/net/tcp 2>/dev/null || true)
  [ -n "${inode:-}" ] || return 1
  listener=""
  for fd in /proc/[0-9]*/fd/*; do
    link=$(readlink "$fd" 2>/dev/null || true)
    case "$link" in
      "socket:[$inode]")
        listener=${fd#/proc/}
        listener=${listener%%/*}
        break
        ;;
    esac
  done
  [ -n "$listener" ] || return 1
  ancestors=" "
  cur=$$
  while [ -n "$cur" ] && [ "$cur" != 1 ]; do
    ancestors="$ancestors$cur "
    cur=$(awk '/^PPid:/{ print $2 }' "/proc/$cur/status" 2>/dev/null || echo 1)
  done
  cur=$listener
  while [ -n "$cur" ] && [ "$cur" != 1 ]; do
    case "$ancestors" in
      *" $cur "*) return 0 ;;
    esac
    cur=$(awk '/^PPid:/{ print $2 }' "/proc/$cur/status" 2>/dev/null || echo 1)
  done
  return 1
}

stop_vite() {
  for p in /proc/[0-9]*; do
    cmd=$(tr '\0' ' ' < "$p/cmdline" 2>/dev/null || true)
    case "$cmd" in
      *'vite dev --host 0.0.0.0 --port 8080'*|*'with-app-env.mjs vite dev'*)
        kill "$(basename "$p")" 2>/dev/null || true
        ;;
    esac
  done
  sleep 0.6
  for p in /proc/[0-9]*; do
    cmd=$(tr '\0' ' ' < "$p/cmdline" 2>/dev/null || true)
    case "$cmd" in
      *'vite dev --host 0.0.0.0 --port 8080'*|*'with-app-env.mjs vite dev'*)
        kill -9 "$(basename "$p")" 2>/dev/null || true
        ;;
    esac
  done
}

if session_owns_port && curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi

if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/; then
  stop_vite
  i=0
  while [ "$i" -lt 20 ]; do
    curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/ || break
    i=$((i + 1))
    sleep 0.3
  done
fi

npm run dev >>/tmp/app-startup.log 2>&1 &
# Preview proxy probes as soon as we return — wait until the helm actually answers.
i=0
while [ "$i" -lt 40 ]; do
  if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/; then
    exit 0
  fi
  i=$((i + 1))
  sleep 0.5
done
exit 0
