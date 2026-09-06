# Practice curriculum and UX plan

The goal: make the studio the Yousician of drawing. Yousician turns an instrument into a
game you can't lose at but can always get better at: a path of small skills, a score you
can see while you play, and a reason to come back tomorrow. This plan studies what
Yousician (and Duolingo, which it borrows from) actually does, audits what our practice
mode does today, and lays out a learning model, a lesson plan, a feedback system, a
progressive-disclosure plan for the whole app, and a phased roadmap.

## 1. What Yousician does

| Mechanic | How Yousician does it | What it's for |
| --- | --- | --- |
| Learning path | Levels 0–10 per instrument, split into themes. Each level is a run of **missions**; a mission bundles a short video, a self-paced exercise ("trainer") and a short song. The path is open: you can jump to any mission, and a **skill test** at a level's start lets you prove you belong further along. | One new concept at a time, always with a payoff piece at the end |
| Real-time feedback | Every note is judged as it's played: Perfect / Early / Late / Miss, colour-coded on the scrolling notation. | The correction arrives while the hand can still act on it |
| End screen | Score, accuracy, stars (three), personal best, then Play again or Next. A song exists at several difficulty levels, each with its own stars. | The same content ramps; you replay for a better star, not for a new page |
| Practice vs Play | Practice mode slows the tempo, loops a section, and can auto-adjust speed to how you play; it doesn't score. Play mode counts for stars and points. | Failure has a safe room, success has a stage |
| Daily goal and streak | Choose a goal in stars or minutes; a daily tracker and reminders; 30-day playing challenges; streaks for consecutive days. | Habit before mastery |
| Weekly challenge and leaderboards | One song a week, ranked by My level / Global / Friends. Personal bests everywhere. | Social proof and a reason to replay |
| Points, badges, levels | XP for every play, achievements for milestones. | Visible accumulation between milestones |
| Onboarding | Instrument → experience → goal → play something within the first minute. Account creation is delayed (Duolingo measured +20% daily actives from moving sign-up behind the first lesson). | Value before commitment |
| Free tier | Limited play time per day; premium removes the cap. | The loop is the product; the cap is the price |

### Progressive disclosure, generalised

1. **Play before you configure.** The first minute is a task, not a tour.
2. **One concept per mission, and the tool arrives with the concept.** New notation, new techniques, new controls appear exactly when a mission needs them.
3. **The same piece ramps.** Difficulty is a property of the demand, not of new content: song level 1 → 5 is the same song with more notes and less help.
4. **Assistance fades.** Colour-coded shapes become plain tabs; hints thin out as scores rise.
5. **Help is triggered by failure, not by menus.** Miss twice and the app suggests slowing down or looping the bar.
6. **Skipping ahead is a test, not a setting.**

## 2. Where our practice mode is today

What exists: five pieces (Warm-up waves, Leaf, Bamboo, Hills at dusk, Bloom), 5 to 26
reference strokes each, traced stroke by stroke. Each stroke is scored on position,
length and direction (`scoreTrace`), accepted at 30, and a lesson ends with a mean
score, stars at 35 / 65 / 85, and a personal best. A road-and-centreline guide, a start
dot, an arrowhead, a coaching hint per step, an in-lesson streak, and a result card with
Next.

What's missing, in the order it matters:

1. **There are no skills.** A lesson teaches "a leaf", not "pressure control". Nothing
   isolates a skill, drills it, and then applies it. Every lesson is a final exam.
2. **The score ignores what makes a mark good in this engine.** Pressure profile,
   speed, and steadiness decide how the bristle, wash, spray and nib look; we score none
   of them. Reference strokes already carry pressure; points carry no timestamps, so
   speed can't be scored yet.
3. **No ramp.** A beginner meets 26-stroke Bloom with the same assist as the warm-up.
   Nothing gets harder except the drawing.
4. **No habit loop.** No daily goal, no streak across days, no "come back for this".
5. **Everything is visible from second zero.** Four style tabs, eleven brushes, a code
   editor and filters face someone who hasn't drawn a line. The welcome card is the
   only onboarding.
6. **The end screen has no breakdown**, so nothing tells you what to change. The
   verdict words (Rough, Okay) judge without instructing; Yousician's Early / Late tell
   you what to do next time.

## 3. Learning model

### Skills (the "notes" of drawing with this engine)

| Skill | What it means here | Where the engine shows it |
| --- | --- | --- |
| Line | A steady pull, straight or curved, that lands where intended | Every brush |
| Start and stop | Tapering in and lifting off: pressure at the ends of a stroke | Bristle fade, nib entry |
| Pressure | Sustain, swell, fade along the stroke | Nib thick/thin, bristle density, wash weight |
| Speed | Even speed; knowing when to flick and when to pull | Spray density, wash bleed, chunk texture |
| Direction and angle | Stroke direction and pen lean change the mark | Chisel, flat shader, calligraphy nib, tilt |
| Shape | Circles, ellipses, S-curves, closed loops that close | Liner, graphite |
| Repetition | Parallel strokes, hatching, evenly spaced rhythm | Hatching passes, grass, feathers |
| Layering | Order and overlap: washes first, light before dark | Wash over wash, spray over wash |
| Size control | The same shape at three sizes | Any brush at different weights |
| Composition | A whole piece, from a reference, with the brush chosen by you | Freehand pieces |

### Structure

**Level → Mission → three parts.** Each mission teaches one skill with one brush:

1. **Trainer** (60–90 s): 6–12 procedurally generated repetitions of one stroke type
   (random positions, same demand), each scored the instant the pen lifts. This is the
   Yousician exercise: cheap to build, endlessly replayable, and where the per-stroke
   feedback words do their work.
2. **Guided piece** (2–4 min): a short drawing traced with the full guide. This is
   today's lesson format.
3. **Perform** (2–4 min): the same piece with the guide stepped down (see assist tiers).
   Only Perform awards stars and points, so the piece can be practised safely and
   performed for the record. This is Practice vs Play.

Missions open in order inside a level; levels are open. "Skip ahead" is a test: perform
the level's final piece at two stars and the level is marked done.

### The path

| Level | Theme | Missions (skill · brush · piece) | Pass |
| --- | --- | --- | --- |
| 0 | Hold the pen (3 min, first launch) | 0.1 Three strokes · liner · none. Pull a line, draw a curve, press and release. Pressure range is measured silently and used to calibrate. | Complete |
| 1 | Lines | 1.1 Straight pulls · liner · **Fence**  ·  1.2 Curves and waves · liner · **Warm-up waves** (existing)  ·  1.3 Zigzag and corners · graphite · **Mountains**  ·  1.4 Start at the dot · liner · **Kite strings** (direction scored) | 2★ on 1.4 |
| 2 | Pressure | 2.1 Taper out · bristle · **Grass**  ·  2.2 Swell · nib · **Rain**  ·  2.3 Thick and thin · nib · **Bamboo** (existing)  ·  2.4 Fade and lift · bristle · **Reeds** | 2★ on 2.3 |
| 3 | Shape and direction | 3.1 Circles and ellipses · graphite · **Pebbles**  ·  3.2 S-curves · liner · **Vine**  ·  3.3 The angled tip · chisel · **Ribbon**  ·  3.4 Lean and roll · calligraphy nib · **Feather**  ·  3.5 Outline over wash · wash + liner · **Leaf** (existing) | 2★ on 3.5 |
| 4 | Value and layering | 4.1 Flat bands · wash · **Sea bands**  ·  4.2 Light before dark · wash · **Stones**  ·  4.3 Spray and soft edges · spray · **Moon**  ·  4.4 Hatching rhythm · ballpoint · **Cube**  ·  4.5 Layered ridges · bristle · **Hills at dusk** (existing) | 2★ on 4.5 |
| 5 | Compose | 5.1 Petals and centre · wash + chisel · **Bloom** (existing)  ·  5.2 Living line · brush pen · **Koi**  ·  5.3 From a reference · your brush · **Teacup** (freehand: silhouette match, no trace)  ·  5.4 Piece of the week · any · rotating | 2★ on 5.3 |

Mission 5.3 is the point of the path: no guide, a reference on the side, scored by
silhouette coverage and stroke count, brush chosen by the user. Everything before it
earns that moment.

## 4. Scoring and feedback

### Dimensions

Per stroke, from the existing `scoreTrace` plus three new terms:

| Dimension | Signal | Needs |
| --- | --- | --- |
| Shape | coverage 0.6 + precision 0.4 against tolerance (exists) | — |
| Length | user / reference length (exists) | — |
| Direction | start at the dot; reversed detection (exists) | — |
| Pressure | mean absolute difference between the user's `p` profile and the reference's, resampled to 48 | reference `p` (exists); off for fingers and mice |
| Speed | mean speed vs target, plus a "rushed / dragged" sign | timestamps: add optional `t` to `Point` (ms from stroke start, delta-coded in the record) |
| Steadiness | high-frequency lateral deviation of the conditioned path | conditioned points (exist) |

A trainer weights its skill's dimension at 0.5; a guided piece weights shape 0.5 and
the rest evenly; Perform weights all evenly.

### Feedback words

One word per stroke, chosen from the worst dimension, always an instruction:

| Dimension | Too little | Too much |
| --- | --- | --- |
| Shape | Drifted (arrow toward the line) | — |
| Length | Too short | Too long |
| Direction | Start at the dot | — |
| Pressure | Press harder (where: start / middle / end) | Lighter |
| Speed | Faster | Slower |
| Steadiness | Wobbly: one confident pull | — |
| All good | Clean · Great · Perfect (≥ 70 / 85 / 95) | |

The pill shows the word, the score, and a three-segment ring (shape, pressure, speed).
The verdict vocabulary (Rough, Okay) goes.

### Stars, points, streaks

- Stars for a Perform: mean ≥ 50 → 1★, ≥ 70 → 2★, ≥ 85 and no skipped stroke → 3★.
- Guided pieces keep accepting at 30; Perform accepts at 50, below that the stroke is
  erased and retried (max three tries, then it counts as it is).
- Points: 10 × score per stroke, streak multiplier up to ×2 after five strokes ≥ 80.
  Points feed a hand level (XP), shown only on the progress screen.
- Personal best per mission, per assist tier.

### Assist tiers (our tempo slider)

| Tier | What's shown |
| --- | --- |
| Full | Road, centreline, start dot, arrow, ghost of remaining strokes |
| Light | Centreline and start dot |
| Dots | Start and end dots only |
| Blind | Nothing until the pen lifts, then the reference appears over your stroke |

Auto-adjust: two strokes ≥ 85 step the tier down; two misses step it up and offer
"Loop this stroke" (three more tries of the same stroke). Perform starts one tier below
where the guided run ended. A **speed ghost** — the dash flow along the centreline already
exists; its speed becomes the target — gives the pen something to follow, the way notes
scroll toward the play line.

## 5. Progressive disclosure of the app

| Moment | What's visible | What appears |
| --- | --- | --- |
| First launch | Canvas, Brush, Undo, Lessons. No welcome card. Mission 0.1 starts after one tap on "Start" (or "Just draw" to skip). | — |
| After 0.1 | + Eraser, Export, the Style tab with brushes met so far marked "new" | Coach mark: "Your brushes live here" |
| After 1.4 (Level 1 done) | + Size and opacity, colour swatches | — |
| After 2.1 (first pressure mission) | + Brush tab (weight, pressure curve) | Coach mark on the pressure curve |
| First pen with tilt data | + Pencil tab | Coach mark: "Your Pencil's tilt is on" |
| After Level 4 | + Code tab, Brush Maker link, sample stroke | — |
| Anytime | Menu → "Show all tools" flips everything on, persisted | — |

Rules: one coach mark at a time, only at the moment the feature becomes relevant, never
on a keyboard action, and dismissable by drawing. Existing users (any saved drawing or
progress) start with everything on.

### Home and "Today"

The practice picker becomes a **Path** screen: levels as rows, missions as nodes, stars
under each, the next mission highlighted. Above it a **Today** strip: continue where you
left off, a two-minute warm-up trainer, the piece of the week, and the daily goal ring.

## 6. Habit loop

- **Daily goal**: 3 stars or 5 minutes (chosen once, editable). A small ring on the dock
  fills during the day; completing it is the one celebration per day.
- **Streak**: consecutive days with the goal met, with one free freeze per week so a
  missed day doesn't reset to zero (recovery-first streak design).
- **Piece of the week**: one piece for everyone, best score kept per week. Without a
  backend it's "your best this week vs last"; with one it becomes a leaderboard (My level
  / Everyone / Friends).
- **Achievements**: first 3★, all brushes met, 7-day streak, 100 pencil strokes, first
  blind Perform, and so on. Quiet, on the progress screen.
- **Reminders**: ask for notification permission after the second day's goal, at the
  moment of the win, never on first launch.
- **Progress screen**: skill radar (Line, Pressure, Speed, Shape, Layering, Compose),
  stars per level, minutes practised, hand level.

## 7. Data and code mapping

- `Point`: optional `t` (ms since stroke start); serialised delta-coded under key `t`.
  Reference strokes gain a speed profile generated with the geometry helpers.
- New types in `src/practice`: `Skill`, `Trainer` (generator + demand), `Mission`
  (`trainer`, `piece`, `skill`, `brush`), `Level`. Existing `Lesson`s become pieces.
- `scoreTrace` returns `dims` (shape, length, direction, pressure, speed, steadiness) and
  a `tip` (the feedback word and where). Weights per mode.
- Progress v2: per mission `{ stars, best, plays, tier }`; `daily { date, stars, minutes }`;
  `streak { count, lastDay, freezes }`; `disclosure { stage, showAll }`; achievements.
  Migrate v1 personal bests onto the matching pieces.
- `PracticeGuide`: assist tiers and the speed ghost. `PracticePanel`: pill with ring and
  word. New `PathScreen`, `MissionSheet` (Practice / Perform), `ProgressScreen`.
- Pieces are cheap to author: one function per piece using `spline`, `circle`, `frame`
  and the profiles; trainers are generators, not data.

## 8. Roadmap

| Phase | Scope | Size |
| --- | --- | --- |
| 1 · Core loop | Timestamps, scoring dimensions and feedback words, trainers, missions and the Path screen, assist tiers with auto-adjust, Perform mode and star thresholds, Levels 0–2 content | ~2 weeks |
| 2 · Habit | Daily goal and ring, streak with freeze, Today strip, progress screen, achievements | ~1 week |
| 3 · Disclosure | Staged tools and tabs, coach marks, "Show all tools", first launch into Mission 0.1 | ~1 week |
| 4 · Content | Levels 3–5 pieces (nine new), piece of the week rotation, freehand scoring for 5.3 | ~1 week |
| 5 · Community (needs a backend) | Accounts, leaderboards, friends, share cards | later |

Metrics to keep locally from day one: sessions per week, missions per session, median
session length (target 5–10 min), share of users reaching Level 2, and the 3★ rate per
mission (20–40% is the healthy band; higher means the mission is too easy).

## 9. Risks and how the plan handles them

- **Tracing isn't drawing.** Trainers and guided pieces build motor skills; Perform and
  Mission 5.3 ask for the real thing. Free drawing outside lessons is never scored.
- **Fingers and mice have no pressure.** Pressure and tilt dimensions switch off and the
  pill says so once; the score is over the remaining dimensions.
- **Artists don't want a slot machine.** Celebrations stay rare (the daily goal, a new
  best, three stars), a "quiet mode" hides points and streaks, and nothing blocks free
  drawing.
- **Content cost.** Trainers are procedural. Each piece is one function; nine new pieces
  is a few days, and the geometry helpers already exist.

Sources: Yousician support articles on the learning path, practice and play modes, song
scoring and leaderboards, the 30-day challenge and the song end screen; Yousician's 2021
syllabus post; StriveCloud's and Trophy's gamification case studies; Yu-kai Chou on
recovery-first streaks; Duolingo onboarding teardowns (Appcues, Juno School, Relaunch).
