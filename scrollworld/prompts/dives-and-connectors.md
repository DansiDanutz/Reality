# Reality scroll-world — camera clip prompts (architecture B: dive + aerial connector)

Model: `seedance_2_0` for the WHOLE chain. Dives: `--mode std --resolution 1080p --aspect_ratio 16:9 --duration 8 --start-image <scene_i.png>`.
Connectors: `--duration 5`, `--start-image` = LAST frame of dive_i.mp4, `--end-image` = FIRST frame of dive_{i+1}.mp4 (extract with ffmpeg — never use the stills).
Append the style preamble sentence fragment to every prompt: "Soft matte low-poly clay diorama miniature world, tilt-shift, warm amber light against deep navy night. Smooth graceful slow motion. No text."

## dive_1 (orbit)
Single continuous cinematic camera move, no cuts. Begin far out in space looking at the whole miniature glowing Earth, drift closer, descend through the thin blue atmosphere toward the pulsing golden beacon on the night side, clouds parting as the camera dives toward the city glow.

## dive_2 (city)
Single continuous cinematic camera move, no cuts. Begin high above the miniature night city block, descend between the rooftops, glide along the lamplit street past warm windows and tiny citizens, settling toward the small plaza.

## dive_3 (work)
Single continuous cinematic camera move, no cuts. Begin outside the miniature workshop building, fly toward it as the roof gently lifts open, descend inside past shelves and tools toward the glowing desk lamp where a tiny citizen works.

## dive_4 (market)
Single continuous cinematic camera move, no cuts. Begin above the miniature market hall, dive under the striped awnings, glide along the stalls of tiny goods and hanging lanterns toward the golden coin fountain at the center.

## dive_5 (build)
Single continuous cinematic camera move, no cuts. Begin high beside the tiny crane, descend along the scaffolding of the half-built tower, glide through a gap in the structure past builders and warm work lights toward the blueprint table.

## dive_6 (begin)
Single continuous cinematic camera move, no cuts. Begin behind the lone tiny citizen on the hill, slowly arc around to face them as the golden map-marker beacon brightens, then rise gently to reveal the miniature city and curved planet horizon behind them, settling on the hero framing.

## connector_i (between dive_i and dive_{i+1}) — same prompt, swap scene names
Single continuous camera move, no cuts. Pull up and back out of <scene i>, rise into the night sky above the connected miniature world, glide across it, and arrive above <scene i+1>, beginning to descend toward it. Seamless flowing aerial transition.
