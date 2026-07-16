#!/bin/bash
# Reality scroll-world — scene stills batch (local image-only higgsfield CLI).
# Run by David after `higgsfield login` and credits are loaded.
# Calibrates with ONE still first, shows the credit delta, then asks before the rest.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/renders"
NAMES=(orbit city work market build begin)
MODEL="nano-banana-pro"
mkdir -p "$OUT"

command -v higgsfield >/dev/null || { echo "higgsfield CLI not on PATH"; exit 1; }
higgsfield credits 2>/dev/null | grep -q '"ok": true' || {
  echo "Not authenticated — run: higgsfield login"; exit 1; }

credits() { higgsfield credits 2>/dev/null | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("data",{}).get("credits",d))'; }

gen() { # gen <index 1..6>
  local i="$1" name="${NAMES[$((i-1))]}"
  echo "→ scene_$i ($name)"
  higgsfield generate "$(cat "$DIR/prompts/still_$i.txt")" \
    -m "$MODEL" -a 3:2 -r 2k -y -d -o "$OUT" 2>&1 | tail -3
}

BEFORE=$(credits); echo "Credits before: $BEFORE"
gen 1
AFTER=$(credits); echo "Credits after calibration still: $AFTER (spent: check delta)"
echo "Estimated total for remaining 5 stills: 5 × (that delta)."
read -r -p "Generate the remaining 5 stills? [y/N] " ok
[ "$ok" = "y" ] || { echo "Stopped after calibration."; exit 0; }
for i in 2 3 4 5 6; do gen "$i"; done
echo "Done. Review renders in $OUT for cohesion (same angle/palette/light),"
echo "then: webp-encode to ~/Fable/public/scrollworld/<name>.webp and hand the"
echo "approved stills to Claude for the video chain (Higgsfield MCP) per"
echo "~/.claude/skills/scroll-world/references/reality-preset.md"
