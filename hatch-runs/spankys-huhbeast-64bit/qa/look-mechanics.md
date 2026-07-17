Spanky's Huhbeast look mechanics

The natural gaze motion is an earnest, slightly awkward head-and-eye search while the sturdy lower body stays anchored. The creature is not a turntable object: do not rotate the whole sprite. Its oversized glossy eyes lead the gaze, the broad low-poly head and underbitten lower jaw follow with small yaw/pitch changes, the raised bracing paw stays near its balancing position, and the long striped tail counterbalances with subtle lag.

Cardinal pose families:

- 000 up: pupils/eye highlights lift, upper lids open, head tips slightly upward, ears perk unevenly, underbite remains visible from below the upper muzzle.
- 090 screen-right: face/head turns toward screen-right; nose/muzzle and pupils shift right of head center; screen-right cheek and ear become more prominent; tail lags left as counterweight.
- 180 down: pupils/eye highlights drop, head tucks slightly, brow/ears show concerned concentration, underbite and lower canine remain visible but lower jaw points slightly downward.
- 270 screen-left: face/head turns toward screen-left; nose/muzzle and pupils shift left of head center; screen-left cheek and ear become more prominent; tail lags right as counterweight.

Intermediate directions should interpolate smoothly between these families in even 22.5-degree steps. Preserve the 64-bit low-poly model look, tabby texture bands, huge watery eyes, permanent open underbite, upward lower canine, visible tiny lower teeth, and raised bracing-paw silhouette. No labels, arrows, guide marks, whole-sprite rotation, scenery, shadows, or detached effects.
