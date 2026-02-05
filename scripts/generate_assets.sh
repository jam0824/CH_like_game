#!/usr/bin/env bash
set -euo pipefail

CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
IMAGE_GEN="$CODEX_HOME/skills/imagegen/scripts/image_gen.py"
OUT_DIR="output/imagegen"

mkdir -p "$OUT_DIR" assets/tiles assets/sprites assets/chips

python "$IMAGE_GEN" generate \
  --prompt "Seamless top-down pixel art stone floor tile, ancient fantasy ruins, indigo-gray slate, gold inlay runes, subtle cracks, faint dust glow" \
  --size 1024x1024 \
  --quality medium \
  --out "$OUT_DIR/floor.png" \
  --use-case "game asset tile" \
  --style "pixel art, top-down" \
  --constraints "seamless tile, no text, no watermark"

python "$IMAGE_GEN" generate \
  --prompt "Top-down pixel art exit portal tile, circular rune gate, ancient fantasy ruins, gold and indigo glow, centered, ornate stone ring" \
  --size 1024x1024 \
  --quality medium \
  --background transparent \
  --output-format png \
  --out "$OUT_DIR/exit.png" \
  --use-case "game asset tile" \
  --style "pixel art, top-down" \
  --constraints "transparent background, no text, no watermark"

python "$IMAGE_GEN" generate \
  --prompt "Top-down pixel art golem mage (female), fantasy ruins, ornate gold and indigo armor, small staff, idle pose, facing down" \
  --size 1024x1024 \
  --quality medium \
  --background transparent \
  --output-format png \
  --out "$OUT_DIR/player.png" \
  --use-case "game sprite" \
  --style "pixel art, top-down" \
  --constraints "transparent background, single character, no text, no watermark"

python "$IMAGE_GEN" generate \
  --prompt "Top-down pixel art obsidian guardian enemy, ancient ruins, emerald core glow, bulky silhouette, idle pose, facing down" \
  --size 1024x1024 \
  --quality medium \
  --background transparent \
  --output-format png \
  --out "$OUT_DIR/enemy.png" \
  --use-case "game sprite" \
  --style "pixel art, top-down" \
  --constraints "transparent background, single enemy, no text, no watermark"

python "$IMAGE_GEN" generate \
  --prompt "Pixel art icon, rune start arrow symbol, gold and indigo, centered, no frame" \
  --size 1024x1024 \
  --quality medium \
  --background transparent \
  --output-format png \
  --out "$OUT_DIR/chip_start.png" \
  --use-case "game ui icon" \
  --style "pixel art icon" \
  --constraints "transparent background, no text, no watermark"

python "$IMAGE_GEN" generate \
  --prompt "Pixel art icon, small floating rune dot for NOP, centered, gold trim, no frame" \
  --size 1024x1024 \
  --quality medium \
  --background transparent \
  --output-format png \
  --out "$OUT_DIR/chip_nop.png" \
  --use-case "game ui icon" \
  --style "pixel art icon" \
  --constraints "transparent background, no text, no watermark"

python "$IMAGE_GEN" generate \
  --prompt "Pixel art icon, demon mask rune with a small question glyph, fantasy style, gold trim, centered, no frame" \
  --size 1024x1024 \
  --quality medium \
  --background transparent \
  --output-format png \
  --out "$OUT_DIR/chip_enemy_exists.png" \
  --use-case "game ui icon" \
  --style "pixel art icon" \
  --constraints "transparent background, no text, no watermark"

python "$IMAGE_GEN" generate \
  --prompt "Pixel art icon, treasure chest with a small question glyph, gold trim, centered, no frame" \
  --size 1024x1024 \
  --quality medium \
  --background transparent \
  --output-format png \
  --out "$OUT_DIR/chip_treasure_exists.png" \
  --use-case "game ui icon" \
  --style "pixel art icon" \
  --constraints "transparent background, no text, no watermark"

python "$IMAGE_GEN" generate \
  --prompt "Pixel art icon, arrow pointing toward a small enemy silhouette, gold and indigo, no frame" \
  --size 1024x1024 \
  --quality medium \
  --background transparent \
  --output-format png \
  --out "$OUT_DIR/chip_move_to_enemy.png" \
  --use-case "game ui icon" \
  --style "pixel art icon" \
  --constraints "transparent background, no text, no watermark"

python "$IMAGE_GEN" generate \
  --prompt "Pixel art icon, arrow pointing to a treasure chest, gold and indigo, no frame" \
  --size 1024x1024 \
  --quality medium \
  --background transparent \
  --output-format png \
  --out "$OUT_DIR/chip_move_to_treasure.png" \
  --use-case "game ui icon" \
  --style "pixel art icon" \
  --constraints "transparent background, no text, no watermark"

python "$IMAGE_GEN" generate \
  --prompt "Pixel art icon, golden sword slash effect, centered, no frame" \
  --size 1024x1024 \
  --quality medium \
  --background transparent \
  --output-format png \
  --out "$OUT_DIR/chip_attack.png" \
  --use-case "game ui icon" \
  --style "pixel art icon" \
  --constraints "transparent background, no text, no watermark"

python "$IMAGE_GEN" generate \
  --prompt "Pixel art icon, arrow pointing to a glowing portal, gold and indigo, no frame" \
  --size 1024x1024 \
  --quality medium \
  --background transparent \
  --output-format png \
  --out "$OUT_DIR/chip_move_to_exit.png" \
  --use-case "game ui icon" \
  --style "pixel art icon" \
  --constraints "transparent background, no text, no watermark"

python "$IMAGE_GEN" generate \
  --prompt "Top-down pixel art trap tile, glowing rune circle with small spikes, gold and crimson, ancient ruins style" \
  --size 1024x1024 \
  --quality medium \
  --background transparent \
  --output-format png \
  --out "$OUT_DIR/trap.png" \
  --use-case "game asset tile" \
  --style "pixel art, top-down" \
  --constraints "transparent background, no text, no watermark"

python "$IMAGE_GEN" generate \
  --prompt "Top-down pixel art treasure chest tile, small wooden chest with gold trim, fantasy ruins style, centered, ornate latch" \
  --size 1024x1024 \
  --quality medium \
  --background transparent \
  --output-format png \
  --out "$OUT_DIR/treasure.png" \
  --use-case "game asset tile" \
  --style "pixel art, top-down" \
  --constraints "transparent background, no text, no watermark"

python - << 'PY'
from PIL import Image
from pathlib import Path

out_dir = Path('output/imagegen')

sizes = {
    'floor.png': ('assets/tiles/floor.png', 64),
    'exit.png': ('assets/tiles/exit.png', 64),
    'player.png': ('assets/sprites/player.png', 64),
    'enemy.png': ('assets/sprites/enemy.png', 64),
    'chip_start.png': ('assets/chips/start.png', 64),
    'chip_nop.png': ('assets/chips/nop.png', 64),
    'chip_enemy_exists.png': ('assets/chips/enemy_exists.png', 64),
    'chip_treasure_exists.png': ('assets/chips/treasure_exists.png', 64),
    'chip_move_to_enemy.png': ('assets/chips/move_to_enemy.png', 64),
    'chip_move_to_treasure.png': ('assets/chips/move_to_treasure.png', 64),
    'chip_attack.png': ('assets/chips/attack.png', 64),
    'chip_move_to_exit.png': ('assets/chips/move_to_exit.png', 64),
    'trap.png': ('assets/tiles/trap.png', 64),
    'treasure.png': ('assets/tiles/treasure.png', 64),
}

for src_name, (dst, size) in sizes.items():
    src = out_dir / src_name
    if not src.exists():
        print(f"Missing {src}")
        continue
    img = Image.open(src).convert('RGBA')
    img = img.resize((size, size), Image.NEAREST)
    Path(dst).parent.mkdir(parents=True, exist_ok=True)
    img.save(dst)
    print(f"Wrote {dst}")
PY

echo "Done. Assets written to assets/."
