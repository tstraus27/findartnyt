Create one horizontal animation strip for Codex pet `kitten`, state `running-right`.

Use the attached canonical base for identity. Use the attached layout guide only for slot count, spacing, centering, and padding; do not draw the guide.

Output exactly 8 full-body frames in one left-to-right row on flat pure blue #0000FF. Treat the row as 8 invisible equal-width slots: one centered complete pose per slot, evenly spaced, with no overlap, clipping, empty slots, labels, or borders.

Identity: same pet in every frame: Make this as close to the real cat Kitten as possible, as a caricature in the style of the provided owl sprite. Do not invent a different creature and do not make an owl. Subject identity: grey/silver tabby cat, more grey than brown, pale cream muzzle/chest, dark tabby forehead stripes, bright pale green eyes, orange-pink nose, black lips/dark mouth edges, massive comical underbite, lower jaw projects beyond upper jaw, mouth almost never fully closes, one oversized lower canine sticks upward outside the lip like a tiny ivory hook, several tiny lower teeth always visible. Default state is peaceful, cute, curious, slightly confused, earnest. Pointer/hover/attention reaction is naughty and aggressive: hissing, biting, ears pinned or flared, eyes narrowed, lips pulled back, paw swatting, based on the provided attack photo. Style reference: chunky retro pixel-sprite pet like the owl screenshot: thick dark outline, compact round readable body, crisp pixel edges, simple limited shading, glossy oversized eyes, small feet, no 3D low-poly, no modern plush, no realistic fur detail. No text, logos, scenery, shadows, detached effects, furniture, glasses, or owl traits.. Preserve silhouette, face, proportions, markings, palette, material, style, and props.
Style: Pet-safe sprite: compact full-body mascot, readable in a 192x208 cell, clear silhouette, simple face, stable palette/materials, and crisp edges for chroma-key extraction. Style `pixel`: Pixel-art-adjacent digital mascot with a chunky silhouette, simple dark outline, limited palette, flat cel shading, and visible stepped edges. User style notes: Chunky retro pixel-sprite style like the owl reference: bold black outline, compact cute pet proportions, simple shaded grey tabby bands, glossy green eyes, orange nose, black lips, massive underbite; exact Kitten caricature, not a new creature..
Animation continuity: keep apparent pet scale and baseline stable within the row unless the state itself intentionally changes vertical position, such as `jumping`. Move the pose within the slot instead of redrawing the pet larger or smaller frame to frame.

State action: Dragging-right loop: show directional movement to the right through body and limb poses only.

State requirements:
- Show directional drag movement to the right through body, limb, and prop movement only.
- The row must unmistakably face and travel right.
- The movement cadence must alternate visibly across the 8 frames instead of repeating one nearly static stride.
- Do not draw speed lines, dust clouds, floor shadows, motion trails, or detached motion effects.

Clean extraction: crisp opaque edges, safe padding, no scenery, text, guide marks, checkerboard, shadows, glows, motion blur, speed lines, dust, detached effects, stray pixels, or chroma-key colors inside the pet.
