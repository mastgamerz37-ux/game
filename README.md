# THE LAST PERIOD

> *"School mein ek last period kabhi khatam nahi hua."*

A **3D story RPG + psychological horror** game. One abandoned school, four
friends, five chapters, three endings. 30–60 minutes. Runs in the browser.

Built with **Three.js + Vite** — no engine install, no asset pipeline, no
Unity account. Every sound is synthesised at runtime, every prop is generated
from primitives, and the character models are **drop-in replaceable**.

```
npm install
npm run dev      # → http://localhost:5173
```

---

## The story

You and three friends break into a school that has been shut for seven years.
Twenty years ago a student disappeared; his name is still marked **PRESENT** in
the 1998 attendance register. It is a joke, obviously.

The gate locks behind you. The loudspeaker says:

> **"Good evening, students. Your last period begins now."**

### Chapters

| # | Chapter | What happens |
| --- | --- | --- |
| 1 | **The Gate** | Enter, gate locks, PA announcement. Find the generator room, work out `breaker → valve → start`, bring the lights back. First horror event. |
| 2 | **Attendance** | Find the store key, open the reception drawer, read the register: your four names are already written in it. Plus a fifth — `UNKNOWN — PRESENT`. |
| 3 | **The Classroom** | The blackboard asks *"Where is the missing student?"*. Four digits are scattered across the school; the panel beside the board wants them. Solving it swings a bookcase open, and there is a ladder going down. |
| 4 | **The Basement** | A floor that was never on any drawing. The records, the receipt for the family's silence — and the first proper appearance. Then: **RUN → HIDE → FIND THE KEY → CUT THE FUSE**. |
| 5 | **The Last Period** | Four chairs, one teacher desk, one blackboard, one register. The door closes. **"Attendance."** |

### Three endings (+ a secret)

* 🟢 **Escape** — you get out. Morning, police, no body, no basement. The register has four new names.
* 🔴 **Trapped** — you don't. Next morning the school is empty, and the ink on four new lines is still wet.
* 🟣 **Secret** — collect **all 8 truths** and in the last room you get a choice instead of a verdict: *reveal the truth* (the entity was never the villain — the buried record made it) or *leave the school forever*.

Getting caught **3 times** during the basement chase also locks you into Trapped, so hiding actually matters.

---

## The horror mechanic

The monster is **never** on screen continuously. Every scare is staged as a
sequence:

```
Sound → Shadow → Object movement → Short appearance → Chase
```

Concretely: lights flicker *in one direction*, a friend says "humare peeche
koi hai", you turn, nobody is there, a classroom door opens by itself, a
silhouette wearing your friend's shape stands in it, it is gone, and your
actual friend is behind you. Only in chapter 4 does it walk, and then only to
chase.

There is **no combat**. The verbs are `E` (read/take/open) and running.

---

## Cast & your own 3D models

Four character slots, all interchangeable:

```
Character
├── Model            <- PlayerModel.glb / Friend1.fbx / … (yours)
├── Animator         <- procedural rig, or your clip named walk/idle
├── CharacterController
├── PlayerController
└── Interaction
```

| Slot | Name | Role |
| --- | --- | --- |
| `player` | Arjun | protagonist, makes the final call |
| `friend1` | Kabir | brave — walks first, thinks later |
| `friend2` | Meera | logical — reads the clues, does the maths |
| `friend3` | Rohan | funny but scared |
| `ghost` | UNKNOWN | the shadow figure / the thing in the basement |

**To swap in your models:** drop the files into `public/models/`, then list them
in `public/models/models.json`:

```json
{ "player": "PlayerModel.glb", "friend1": "Friend1.fbx", "friend2": "Friend2.obj",
  "friend3": "Friend3.glb", "ghost": "Monster.glb" }
```

That's the whole procedure. The loader auto-scales to ~1.74 m, anchors the feet
at y=0, plays your `walk`/`idle` clip if one exists (otherwise a procedural
bob), and falls back to the built-in placeholder rig if the file is missing or
broken — so the game can never soft-lock while you are iterating on art. The
controller moves a transform, never a mesh; dialogue, follow-AI, hiding and the
chase keep working untouched. Details: [`public/models/README.md`](public/models/README.md).

---

## The map

One building. `src/data/floors.js` is pure data — a bay grid, wall *runs* with
door gaps punched in them, and interaction anchors:

```
             x -24.5 ─────── -11.5 ── -1.5 ─── 6.5 ──── 16.5 ── 24.5
   z  8.35 ┌───────────┬───────────┬─────────┬─────────┬─────────┐
           │  rooms N  │           │         │         │         │
   z  1.35 ├───────────┴───────────┴─ ─ ─ ─ ─┴─ ─ ─ ─ ─┴─────────┤   ← corridor doors
   z -1.35 │                    C O R R I D O R                    │
   z -8.35 ├───────────┬───────────┬─────────┬─────────┬─────────┤
           │  rooms S  │           │  HALL   │         │         │
   z -20   └───────────┴───────────┴───▲─────┴─────────┴─────────┘  ← you start here
                                     THE GATE
```

| Level | Rooms |
| --- | --- |
| Ground | Classroom 1 · Classroom 2 · Lost & Found · Staff Lounge · **Reception** · Entrance Hall + Main Gate · Generator Room · Principal's Office · General Store · Stairwell |
| First | Old Classroom (period 6) · Locked Classroom · Library · Science Lab · Dissection Room · Store Room · Staff Room · **Room With No Number** · Stairwell |
| Basement | Old Records · Holding Room · Fuse Room · Sump · Boiler · Coal Store · **The Last Period** · Behind the Bookcase |

Movement between levels is by interaction (`Stairs up`, `Ladder going down`) so
no stair geometry can ever trap you; stairs deliberately have **no colliders**.

Two offline validators keep the map honest while you edit it:

```bash
node tools/walk.mjs --all    # 26 routes: can the player physically get there?
node tools/anchors.mjs       # every clue/door/stair has standable, reachable ground
node tools/worldcheck.mjs    # the level is ONE connected region once doors open
node tools/cam.mjs           # third-person arm never sits inside a wall + touch axis
node tools/simulate.mjs      # plays all 5 chapters headless (puzzles, chase, endings)
npm run check              # the four above in one go
```

---

## Controls

| | |
| --- | --- |
| `W A S D` / arrows | move (a diagonal is not faster than a straight line) |
| `Shift` | sprint (has a breath meter — the monster does not get tired) |
| `C` | crouch (quieter, less scary) |
| mouse | look · `E` / `Space` interact · `Esc` pause |
| `F` | torch · `V` first/third person |
| `J` | journal (your clues + the panel digits) |
| `M` | mute |
| `` ` `` | debug minimap |
| `?debug=1` | chapter-jump buttons in the pause menu, `1`–`5` jump, `G` give keys, `T` all clues, `X` skip a beat |

Headphones. Lights off. Pointer lock is required for mouse-look — click the
canvas if the browser ate it.

### Touch / phone

On a coarse pointer (phone, tablet, some laptops) the game mounts an on-screen
rig automatically: left thumb stick (analogue — how hard you push is how fast
Arjun walks), right half of the screen to look, and `USE / TORCH / VIEW /
NOTES / RUN / SIT / MUTE` plus a `MENU` button. A tap on the world itself is
the same as `E`. The controls vanish whenever a panel or the pause menu is open,
so taps land on the panel instead.

Force it on with `?touch=1`, off with `?touch=0`. No pointer lock is used in
touch mode, so nothing pauses when the browser "loses" the cursor.

---

## Code layout

```
src/
  main.js              renderer, camera rig, frame loop, interaction targeting, fear meter
  constants.js         heights, speeds, colours — the tuning file
  utils.js             canvas-texture helpers, chalk text, easing, RNG
  core/
    input.js           pointer-lock mouse-look + keys, enable/disable gate
    touch.js           on-screen stick + look-pad + action buttons (writes into Input)
    audio.js           every sound synthesised (creaks, whispers, PA announcement, stingers)
    collision.js       AABB slide movement + BFS flow field for the monster
  data/
    floors.js          THE SCHOOL: geometry, doors, lights, anchors, clues
    dialogue.js        all lines, keyed by beat
    characters.js      the cast (colours, roles) — edit names here
  world/
    world.js           builds levels from floors.js; doors, fixtures, gate, lighting
    geometry.js        shared materials + procedural wall/floor/wood textures
    props.js           desks, lockers, shelves, lab benches, generator, bookcase…
    minimap.js         debug overlay
  player/
    controller.js      fp/tp camera, sprint, crouch, head bob, torch battery
  entity/
    models.js          placeholder rig + .glb/.fbx/.obj loader (the modding seam)
    actors.js          friends' follow AI, shadow figure, monster (flow-field chase)
  systems/
    state.js           GameState: chapter/stage/flags/clues, localStorage save
    ui.js              HUD, subtitles, chapter cards, reader, combination pad, endings
    story.js           StoryDirector: the five chapters, the beats, the endings
```

**Where to edit what**

* Add a clue / puzzle / door → `data/floors.js`. Nothing else.
* Write a scare → `data/dialogue.js` + a beat list in `systems/story.js`
  (`await this.saySeq('my_beat')`, `this.flicker()`, `this.shadow.show()`,
  `this.ui.big()`).
* Change a name or a personality → `data/characters.js`.
* Change monster speed / catch distance → `entity/actors.js` (`Monster`).
* Feel of movement → `constants.js`.

Progress autosaves to `localStorage` (chapter + clues + position); the menu
offers **CONTINUE** / **ERASE SAVE**.

---

## Known edges

* Third-person avoids walls by shortening the camera arm (22 samples against
  the level's AABBs, smoothed so it never snaps). It does not *push* sideways,
  so in a doorway you may see the wall for a frame. First person is still the
  intended way to play.
* Touch has no analogue for mouse-sensitivity tuning or for hover tooltips:
  interaction targets are picked by where the camera points, so a imprecise
  thumb means pointing Arjun's nose at things.
* `?debug=1` shows the chapter-jump list in the pause menu; use it to test
  chapters in isolation, and note that `jumpToChapter` grants the keys a chapter
  assumes you already found.
* Textures are painted on canvases at boot, so the first ~300 ms is texture time.
