Create one horizontal animation strip for Codex pet `spanky-s-huhbeast`, state `idle`.

Use the attached canonical base for identity. Use the attached layout guide only for slot count, spacing, centering, and padding; do not draw the guide.

Output exactly 6 full-body frames in one left-to-right row on flat pure blue #0000FF. Treat the row as 6 invisible equal-width slots: one centered complete pose per slot, evenly spaced, with no overlap, clipping, empty slots, labels, or borders.

Identity: same pet in every frame: Base this heavily on the attached real photos of Kitten. Get close to Kitten while still making a tiny original 64-bit console mascot creature. Default personality when not interacted with: peaceful, cute, curious, slightly confused, earnest. She is mostly grey/silver tabby, not brown; pale cream muzzle/chest; bold dark tabby forehead stripes; bright green eyes like the photos; orange-pink nose; black lips and dark mouth edges. Permanent key feature: massive comical underbite based on Kitten, lower jaw projects far past upper jaw, mouth relaxed but never fully closed, black lips slightly parted, one oversized lower canine sticks upward outside the lip like an ivory hook, several tiny lower teeth visible. On mouse/pointer interaction she becomes naughty and kind of aggressive: hisses and bites like the attack photo, ears pin or flare sideways, eyes narrow or glare, lips pull back, teeth show, one paw swats forward; still cute and funny, not scary or grotesque. Iconic silhouette: compact upright grey tabby creature, short sturdy legs, thick neck, long striped tail counterweight, one paw lifted for bracing or swatting, no furniture/scenery. Visual era: late-1990s to early-2000s 64-bit low-poly console mascot, chunky polygon planes, simple baked highlights, bold texture bands, crunchy retro 3D charm; no pixel art, no modern plush rendering. No text, logos, scenery, shadows, detached effects, or props.. Preserve silhouette, face, proportions, markings, palette, material, style, and props.
Style: Pet-safe sprite: compact full-body mascot, readable in a 192x208 cell, clear silhouette, simple face, stable palette/materials, and crisp edges for chroma-key extraction. Style `auto`: Infer the most appropriate pet-safe style from the user request and reference images, then keep that exact style consistent across every row. User style notes: 64-bit late-90s/early-2000s low-poly mascot version of Kitten: grey/silver tabby, green eyes, black lips, orange nose, massive underbite; peaceful cute default, aggressive hiss-bite pointer reaction; chunky polygonal forms and bold texture bands..
Animation continuity: keep apparent pet scale and baseline stable within the row unless the state itself intentionally changes vertical position, such as `jumping`. Move the pose within the slot instead of redrawing the pet larger or smaller frame to frame.

State action: Calm low-distraction resting loop: subtle breathing, tiny blink, slight head/body bob, and only quiet persona-preserving motion.

State requirements:
- CRITICAL: idle is the low-distraction baseline state and the first frame is also used as the reduced-motion static pet.
- Use only subtle idle motion: gentle breathing, a tiny blink, a slight head or body bob, a very small material sway, or another quiet motion that fits the pet persona.
- Keep the pet essentially in the same pose, facing direction, silhouette, markings, palette, and prop state across all 6 frames.
- Idle variation must stay calm but still read as animation; do not repeat effectively identical copies across the loop.
- Do not show waving, walking, running, jumping, talking, working, reviewing, emotional reactions, large gestures, item interactions, or new props.
- Feet, base, body, or object anchor should remain planted or nearly planted.
- The first and last frames should be very close visually so the loop feels calm and does not pop.

Clean extraction: crisp opaque edges, safe padding, no scenery, text, guide marks, checkerboard, shadows, glows, motion blur, speed lines, dust, detached effects, stray pixels, or chroma-key colors inside the pet.
