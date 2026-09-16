# Putting your own 3D models in

The game does **not** assume anything about your character meshes. It only ever
talks to `Character.node`, `.setPosition()` and `.animate()`, so you can swap
the placeholder humans for your own models without touching gameplay code.

## 1. Drop the files here

```
public/models/
  PlayerModel.glb
  Friend1.fbx
  Friend2.obj
  Friend3.glb
  Monster.glb
  models.json
```

## 2. List them in `models.json`

```json
{
  "player":  "PlayerModel.glb",
  "friend1": "Friend1.fbx",
  "friend2": "Friend2.obj",
  "friend3": "Friend3.glb",
  "ghost":   "Monster.glb"
}
```

Empty string (`""`) or a missing file = keep the built-in placeholder rig.

## 3. Restart the dev server (or hard-refresh)

That's it. Movement, dialogue, follow-AI, hiding and the chase all keep working,
because the controller drives a transform, not the model.

## What the loader does for you

| Concern | Handled automatically |
| --- | --- |
| Scale | bounding box height is normalised to ~1.74 m |
| Origin | feet are anchored to y = 0, centre on x/z |
| Facing | models are assumed to face **-Z** (front of the character looks towards -Z). Flip your model 180° in the exporter if it faces the other way. |
| Animation | if the file contains a clip named `walk`/`run`/`idle` it is played and blended by movement speed; otherwise the model gets a procedural bob + lean |
| Shadows | the player's torch is a shadow-casting spotlight; make sure your meshes have `castShadow` if you care |
| Materials | `MeshStandardMaterial` exports fine; keep them unlit-free (no `KHR_materials_unlit`) if you want them visible in the dark |

## If you want a *different* skeleton layout

Placeholder rig used by the game (all boxes, no bones) — useful as a reference
for pivot placement if you want your own model to get the same procedural walk:

```
Character
├── Model            <- your mesh goes here (auto-scaled)
├── limbL / limbR    <- leg pivots at the hip, rotate .rotation.x
├── armL  / armR     <- arm pivots at the shoulder
└── Label            <- floating name sprite (friends only)
```

`ghost` is the shadow figure / monster: the game fades its materials in and
out for the "was that a person?" moments, so use transparent-capable materials.
