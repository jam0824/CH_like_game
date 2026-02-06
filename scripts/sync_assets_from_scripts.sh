#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$ROOT_DIR/scripts/assets"
DST_DIR="$ROOT_DIR/assets"

mkdir -p "$DST_DIR/tiles" "$DST_DIR/sprites" "$DST_DIR/chips"

cp -f "$SRC_DIR/tiles/"*.png "$DST_DIR/tiles/"
cp -f "$SRC_DIR/sprites/"*.png "$DST_DIR/sprites/"
cp -f "$SRC_DIR/chips/"*.png "$DST_DIR/chips/"

echo "Synced assets from scripts/assets -> assets"
