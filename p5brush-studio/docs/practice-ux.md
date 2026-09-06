# Practice UX spec

The interaction design for the curriculum in `curriculum-plan.md`, written before the
code. Everything here is what the user sees and does; the plan says why.

## Navigation

Hash routes (`createHashRouter`). The app ships as a single HTML file (the artifact) and
as a static build with no server rewrites, so paths must live in the fragment; the
iPad's back gesture and the browser's back button then work everywhere. The old `#lab`
switch becomes `?lab=1` only.

| Route | Screen | Back goes to |
| --- | --- | --- |
| `/` | Studio: free drawing, all chrome | — |
| `/learn` | Path: Today strip, levels as rows, missions as nodes | `/` |
| `/learn/:mission` | Mission sheet: the three parts, bests, start | `/learn` |
| `/learn/:mission/:part` | Session (`trainer`, `guided`, `perform`) on the canvas; its result shows in place when the run completes | `/learn/:mission` |
| `/warmup` | Warm-up session; result offers the next mission | `/learn` |
| `/progress` | Stars per level, bests, minutes, then-vs-now pairs | `/learn` |

The engine stays the source of truth for the run; the router only says which run should
exist. A `RouteSync` component starts the run a route names and ends the run when the
route leaves it. Navigating away from a session ends it without a dialog, except a
Perform with at least one stroke, where the card's own close button asks first (the
browser back cannot be intercepted reliably, so it just leaves).

## Screens

### Path (`/learn`)

Centred dialog on tablets and desktops, full-height sheet on phones.

- Header: "Learn", a Progress link, close.
- **Today**: two chips. *Warm-up · 3 min* and *Continue · 1.3 Corners* (the first
  incomplete mission). Later: piece of the week, the goal ring.
- **Levels as rows.** Number, theme, "stars earned / possible". Missions as a horizontal
  row of nodes: id, skill, brush, piece thumbnail (engine-rendered for pieces, an icon
  for trainer-only missions), stars from the best Perform.
- Node states: **next** (accent ring, the one Continue points at), **done** (stars),
  **open** (tappable), **locked** (dimmed, lock glyph; tapping toasts "Finish 1.2
  first"), **soon** (piece not built yet; not tappable, no lock, a quiet "soon" tag).
  Missions open in order inside a level; the first mission of every level is open.
- **Skip ahead** on each level row: a link "Test out: perform 1.4" that starts the
  level's final Perform directly. Two stars marks the level done.

### Mission sheet (`/learn/:mission`)

Small dialog / bottom sheet over the Path.

- Title "1.2 Curves and waves", skill chip, brush chip with the template preview, the
  piece name, one line of what the mission teaches.
- Three rows, each a button: **Trainer** (60–90 s; best "8 of 10 clean"), **Guided**
  (best score), **Perform** (stars, best, the tier it was earned at). Done rows carry a
  check. Trainer-only missions (0.1) show one row.
- Primary button **Start**: the next incomplete part. Any row starts that part.
- Under Perform a segmented **tier** control: Full · Light · Dots · Blind. Default is one
  tier below where the last guided run ended; the best for the selected tier shows
  beside it. This is Yousician's per-difficulty stars.

### Session (`/learn/:mission/:part`, `/warmup`)

The canvas framed on the lesson box; the step card top-centre (phone: below the quick
actions; landscape phone: a left column).

- **Card header**: mission and part ("1.2 · Guided"), step counter ("Stroke 3 of 8",
  trainers: "Rep 3 of 10"), close.
- **Progress segments**: one per step, coloured by result; the current one pulses.
- **Brush line**: swatch, brush name, size, and the hint (trainers: the drill's
  instruction, e.g. "Two dots. Ghost the line twice, then one pull.").
- **Actions**: Undo, Skip, tier pips (Full·Light·Dots·Blind, tap to change), Restart.
  Perform hides Skip and the tier pips (tier is fixed for the run).
- **Feedback pill** (right of the actions): the word, the score, a three-segment ring
  (shape · pressure · speed). Bandwidth rule: an instruction only when a dimension is
  out of band, otherwise "Clean / Great / Perfect" with the number. Perform shows the
  number only.
- **Auto-adjust note**: when the tier steps down or up, a one-line note inside the card
  ("Guide stepped down: centreline only"), no toast.
- **Loop this stroke**: after two misses on a step, a button appears. Looping repeats the
  step three times: each attempt is scored and erased, the pill speaks each time, then
  the step is open again for the attempt that counts.
- **Speed ghost**: the dashed centreline flows at the step's target speed.
- **Blind tier**: nothing is drawn for the current step; after the pen lifts the
  reference appears over the stroke for about a second, then fades.
- **Trainers**: each rep is generated into its own cell of a grid so the strokes tile
  the page like a sheet of practice lines; the strokes stay. Trainer reps default to
  the Dots tier (two dots, one line: the ghosted-line exercise) except curves, waves
  and corners, which start at Light.

### Results (in place, when the run completes)

- **Trainer**: "8 of 10 clean · mean 82", then *Next: Guided piece*, *Again*, *Back*.
- **Guided**: score, *Perform now* (primary), *Again*, *Back to path*.
- **Perform: the critique.** Stars (staggered pop), score, "New best" when it is. The
  three costliest strokes listed with their word and score, and highlighted on the
  canvas in the accent over the user's ink. One line on the dimension that cost the
  most across the piece. **Then vs now**: engine-rendered thumbnails of the first Perform
  of this mission and today's, side by side, once a first attempt exists (the first
  Perform stores its strokes). Then *Next mission*, *Again*, *Back to path*.
- **Warm-up**: confidence mean and clean count, then *Continue to 1.3 Corners* and
  *Just draw*.

### Progress (`/progress`)

Stars per level (earned / possible), missions done, minutes practised, and the list of
then-vs-now pairs (first vs best thumbnails). Skill radar, streaks and goals come with
the habit phase.

## Rules that hold everywhere

- Free drawing outside sessions is never scored.
- Fingers and mice: pressure is simulated, so the pressure dimension is off and the pill
  says so once per session ("Pressure isn't scored for a finger").
- Keyboard: `L` toggles `/learn`, `N` skips, `Esc` closes the top-most sheet; none of
  these animate.
- Motion follows the app's existing rules: sheets use the drawer curve, results rise into
  place, stars pop once, everything else is instant or under 200 ms.
- Progress is local (`p5brush-studio:practice:v2`). Version 1 bests (whole-lesson traces
  with the full guide) migrate onto the matching mission's Perform at the Full tier so
  nobody loses stars.

## Out of scope for this build

Staged tool disclosure and first launch into 0.1 (phase 3), the daily goal, streak and
Today's goal ring (phase 2), seeing modes and the Level 3–6 pieces beyond the ones that
exist (phase 4), anything needing a backend (phase 5). The Path shows those missions as
"soon" so the shape of the whole curriculum is visible from day one.

---

# v2: the Learn experience, from first principles

The first build put Learn inside the studio: dialogs over the canvas, a floating step
card, the tool dock still visible. That is a studio with lessons bolted on. Yousician and
Duolingo are the other way round: the course is the home and the instrument is the
thing you pick up inside a lesson. Version 2 restructures the app around that.

## Principles

1. **The course is the home.** First launch lands on the Path. The free canvas is a
   mode called Sketch, one tap away, and returning users land wherever they were last.
2. **One thing on screen.** A session shows the stroke to draw, a progress bar and the
   canvas. No dock, no style panel, no HUD. Everything that isn't the stroke is gone.
3. **Progress you can feel.** A fat bar that fills with every stroke, nodes that turn
   the level's colour when done, stars under them, a START bubble that bobs on the
   next one. The state of the whole course is legible from a scroll.
4. **Feedback is a colour before it is a word.** Green, amber, red across the bottom
   the instant the pen lifts, then the word and the number. Perform stays neutral.
5. **Physical controls.** Primary buttons and path nodes have a bottom edge that
   presses down (the Duolingo button). Presses are felt, not just seen.
6. **Celebrate rarely, properly.** A run ends in a docked results panel: stars pop,
   stat tiles arrive one after another, the drawing stays visible beside them. Nothing
   else in the app animates like that.
7. **Motion rules still hold.** Springs only on the things that are alive (the START
   bubble, the progress bar); everything else is ease-out under 300 ms; keyboard
   toggles are instant; reduced motion keeps the fades and drops the movement.

## Structure

| Route | Mode | Chrome |
| --- | --- | --- |
| `/` | redirect | first run → `/learn`, otherwise the last mode used |
| `/learn`, `/learn/:mission` | Learn | header nav (Learn · Sketch · Progress), the winding path, a mission bubble anchored to its node |
| `/learn/:mission/:part`, `/warmup` | Session | top bar (close, progress, streak), instruction, canvas, bottom controls, feedback bar; results panel when done |
| `/progress` | Progress | header nav, stats, stars per level, then-vs-now |
| `/sketch` | Sketch | the studio as before; the graduation cap goes to Learn |

## Screens

**Learn home.** A vertical path, one node per mission, nodes offset left and right in a
gentle zigzag. Each level opens with a banner in its own colour (Level 1 ochre, 2 olive,
3 teal, 4 indigo, 5 plum, 6 ink, 0 sienna) carrying the theme, a one-line description
and, when the level's capstone is still open, "Jump here?". Nodes are 68 px discs with
a 6 px bottom edge; done nodes are solid in the level colour with a check and three
small stars beneath; the next node is larger, in colour, with a bobbing START bubble;
open nodes are outlined; locked nodes grey with a lock; unbuilt nodes dashed with
"soon". A piece's engine-rendered thumbnail sits inside its disc. Tapping a node opens
a bubble under it with the mission's parts, bests, the Perform tier and a Start button
in the level colour.

**Session.** Top bar: close, a 14 px progress bar in the level colour that fills per
stroke with a small overshoot, the streak flame when it reaches two. Below it the
instruction in the display face, then the brush chip and, outside Perform, the tier
pips. The canvas takes the rest. Bottom left: Undo, Skip, Loop, Restart as quiet
buttons. Bottom right (full width on phones): the feedback bar, which slides up in the
outcome's colour, shows the word, the ring and the number, and slides away after two
seconds; a new stroke retargets it rather than restarting it. Closing a Perform with
strokes on the page asks first, in a small dialog.

**Results.** A docked panel: a bottom sheet on phones, a right column on wide screens,
so the drawing stays visible with the costly strokes highlighted. A colour band with
the heading and the stars, then stat tiles (Score, Clean, Best) arriving 80 ms apart,
the critique, then-vs-now, and a sticky action row with a fat Continue.

**Progress.** A page, not a dialog: the three numbers, stars per level as bars in the
level colours, then-vs-now pairs.

## What stays

The engine, the scoring, the assist tiers, routes, the studio's own chrome and its
Ink & Paper theme. The display face changes to Nunito for headings, nodes and primary
buttons so the course reads as friendly; body text stays Inter.
