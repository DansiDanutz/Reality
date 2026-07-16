# Reality scroll-world intro — generation runbook

A scroll-scrubbed "fly through the world" cinematic intro (engine + method from
[oso95/scroll-world](https://github.com/oso95/scroll-world), MIT). The code side is fully
wired in `src/components/scrollworld/`; it stays dormant until the assets below exist and
`SCROLL_WORLD_ENABLED` is flipped to `true` in `scrollworld.config.ts`.

**David generates the visuals (Higgsfield credits — his call), Claude assembles.**

## Budget (desktop-only, 6 scenes)
- 6 stills (`gpt_image_2`, ~15 cr each) ≈ 90
- 6 dives + 5 connectors (`seedance_2_0`, ~40–55 cr each) ≈ 440–605
- +15% re-roll headroom → **~600–800 credits total**
- Cheap previz option: run the whole chain on `seedance_2_0_mini` first (~¼ cost).
- Mobile 9:16 native chain would roughly double video spend — skipped unless requested.

## Steps
1. **Stills** — prompts in `prompts/stills.md` (each = `prompts/style-preamble.txt` + subject):
   `higgsfield generate create gpt_image_2 --prompt "$(cat still_i.txt)" --aspect_ratio 3:2 --resolution 2k --quality high --wait --wait-timeout 15m --json`
   Review all 6 for cohesion before continuing. Save as `scene_1..6.png`.
2. **Dives** — prompts in `prompts/dives-and-connectors.md`:
   `higgsfield generate create seedance_2_0 --prompt "..." --start-image scene_i.png --mode std --resolution 1080p --aspect_ratio 16:9 --duration 8 --wait --json`
3. **Connectors** — endpoints MUST be actual rendered frames, never the stills:
   `ffmpeg -sseof -0.15 -i dive_i.mp4 -frames:v 1 -q:v 2 dive_i_last.png`
   `ffmpeg -ss 0 -i dive_{i+1}.mp4 -frames:v 1 -q:v 2 dive_next_first.png`
   then `--start-image dive_i_last.png --end-image dive_next_first.png --duration 5`.
4. **Encode** every clip:
   `ffmpeg -i src.mp4 -an -vf "unsharp=5:5:0.8:5:5:0.0" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart out.mp4`
5. **Place assets** in `public/scrollworld/`:
   `orbit|city|work|market|build|begin.webp` (stills, webp-encoded) and
   `vid/orbit|city|work|market|build|begin.mp4` + `vid/conn1..5.mp4`.
6. Flip `SCROLL_WORLD_ENABLED = true`, run `npm run dev`, QA seams per the skill's Step 8
   (screenshot either side of each seam; check `video.seekable.end(0) > 0`).

Gotchas (NSFW re-rolls, kling fallback, zsh array indexing) are in
`~/.claude/skills/scroll-world/SKILL.md`.
