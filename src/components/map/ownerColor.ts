/**
 * A stable, per-owner color for the map — turns the anonymous violet field of
 * other players' buildings into a visibly populated world (P6). Pure and
 * framework-free so it's unit-testable and reusable (dots today; owner cards
 * and avatar rings later).
 *
 * The citizen id hashes to a hue on the full wheel; saturation and lightness
 * are fixed and tuned so EVERY hue reads against the near-black globe (there is
 * no dark, vanishing corner of the palette) while staying vivid, not neon.
 * Same id → same color, forever; neighbours in id space land far apart in hue
 * because the hash avalanches.
 */
export function colorForCitizen(cid: string): string {
  // djb2 accumulate…
  let h = 5381
  for (let i = 0; i < cid.length; i++) {
    h = ((h << 5) + h + cid.charCodeAt(i)) >>> 0
  }
  // …then a MurmurHash3 finalizer to avalanche the bits. Without it, ids that
  // differ only in their last character (djb2 changes the result by ~1) map to
  // near-identical hues; the mix makes any single-char change spread across the
  // whole wheel.
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b) >>> 0
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35) >>> 0
  h = (h ^ (h >>> 16)) >>> 0 // final mix; >>> 0 keeps it unsigned before scaling
  const hue = Math.floor((h / 0x100000000) * 360)
  return `hsl(${hue}, 70%, 62%)`
}
