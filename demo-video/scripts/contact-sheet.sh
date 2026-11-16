#!/usr/bin/env bash
# Tiles one frame every N seconds of a rendered video into a contact sheet PNG
# (read left to right, top to bottom; frame k is at k*N seconds).
# Usage: scripts/contact-sheet.sh out/video/kompyle-demo-16x9.mp4 [every_seconds] [cols] [rows]
set -euo pipefail
IN="$1"; EVERY="${2:-3}"; COLS="${3:-5}"; ROWS="${4:-6}"
OUT="${IN%.mp4}.sheet.png"
ffmpeg -loglevel error -y -i "$IN" -vf "fps=1/${EVERY},scale=480:-1,tile=${COLS}x${ROWS}:padding=6:color=black" -frames:v 1 "$OUT"
echo "$OUT"
