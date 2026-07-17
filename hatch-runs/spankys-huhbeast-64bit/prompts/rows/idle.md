Create one horizontal animation strip for Codex pet `spanky-s-huhbeast`, state `idle`.

Use the attached canonical base for identity. Use the attached layout guide only for slot count, spacing, centering, and padding; do not draw the guide.

Output exactly 6 full-body frames in one left-to-right row on flat pure magenta #FF00FF. Treat the row as 6 invisible equal-width slots: one centered complete pose per slot, evenly spaced, with no overlap, clipping, empty slots, labels, or borders.

Identity: same pet in every frame: Original caricature creature evolved from a real tabby cat named Kitten, whose nickname was almost Spanky. Not simply a cat portrait. Visual era: late-1990s to early-2000s 64-bit console mascot creature, chunky low-poly toy proportions, simple shaded polygon planes, crisp silhouette, slightly crunchy retro 3D charm, like a small unlockable companion from a Dreamcast/N64/early GameCube-adjacent world; no pixel art, no modern smooth plush rendering. Most important: dramatic comical underbite, lower jaw projects beyond upper jaw, mouth almost never fully closed, one oversized lower canine sticks upward outside the lip like a tiny ivory hook, several tiny lower teeth always visible and slightly too large, expression reads '...huh?' not a smile. Enormous glossy watery expressive eyes dominate face; confused, curious, slightly concerned, incredibly earnest, unintentionally funny; one ear or eyebrow ridge often higher. Iconic silhouette: standing upright on short sturdy legs, round body, slightly oversized head, thick neck, long striped tail as counterweight, large triangular independently swiveling ears, one tiny paw raised as if bracing against a shelf or doorframe, one foot on floor and the other reaching toward a higher surface, but no actual furniture or scenery in sprite. Warm neutral browns, creams, gray tabby striping simplified into bold 64-bit texture bands. Movement should waddle because of oversized jaw; startled pose freezes then awkward sideways hop; no text, logos, scenery, shadows, detached effects, or props unless body-attached.. Preserve silhouette, face, proportions, markings, palette, material, style, and props.
Style: Pet-safe sprite: compact full-body mascot, readable in a 192x208 cell, clear silhouette, simple face, stable palette/materials, and crisp edges for chroma-key extraction. Style `auto`: Infer the most appropriate pet-safe style from the user request and reference images, then keep that exact style consistent across every row. User style notes: 64-bit late-90s/early-2000s low-poly mascot style: chunky polygonal forms, simple baked highlights, bold tabby texture blocks, glossy oversized eyes, readable silhouette, warm browns/cream/gray, permanent underbite and one raised bracing paw as identity anchors..
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
