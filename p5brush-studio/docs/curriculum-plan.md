# Practice curriculum and UX plan

The goal: make the studio the Yousician of drawing. Yousician turns an instrument into a
game you can't lose at but can always get better at: a path of small skills, a score you
can see while you play, and a reason to come back tomorrow. This plan studies what
Yousician does, what the drawing courses people actually pay for do, what the current
learn-to-draw apps do, and what motor-learning research says about feedback. It then
audits our practice mode and lays out a learning model, a lesson plan, a feedback
system, a progressive-disclosure plan for the whole app, and a phased roadmap.

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
2. **One concept per mission, and the tool arrives with the concept.**
3. **The same piece ramps.** Difficulty is a property of the demand, not of new content.
4. **Assistance fades.** Colour-coded shapes become plain tabs; hints thin out as scores rise.
5. **Help is triggered by failure, not by menus.** Miss twice and the app suggests slowing down or looping the bar.
6. **Skipping ahead is a test, not a setting.**

## 2. How people actually learn to draw (what they pay for)

| Product | Format | What learners pay for | What we take |
| --- | --- | --- | --- |
| **Drawabox** | Free text-and-video curriculum, Lessons 0–7 plus the 250 Box and 250 Cylinder challenges; paid official critiques. One to two years for most students. | Critique, and a structure strict enough to trust | Named primitive drills (superimposed lines, ghosted lines, ghosted planes, table of ellipses, ellipses in planes, funnels); the **ghosting method** (rehearse the motion in the air, then commit); draw from the shoulder, one confident stroke, never correct a line; the **50% rule** (half your time on exercises, half drawing for fun); volume challenges as long milestones |
| **Proko** | À-la-carte video courses (Drawing Basics is ~40 lessons). Each lesson: lecture → demonstration → one or two assignments at **two difficulty levels** → critique videos built from student submissions. Warm-ups before sessions. | Assignments with demos, and the chance to be critiqued | Two levels per assignment (our guided / perform); critique as content; a warm-up ritual |
| **New Masters Academy, Watts Atelier** | Subscription library; atelier method: copy plates, block in, sight-size, long studies. | Access to great teachers and a canon | Copying is legitimate learning when the demand rises; progressive accuracy |
| **Schoolism** | Same videos at two prices: self-taught, or with instructor feedback. | The feedback tier is the premium | Feedback is the product |
| **Domestika, Skillshare** | Short project-based classes ($10–15 a month or per course); the final project goes to a community feed, instructors reply; certificates need peer feedback. | A finished thing to show, and someone to show it to | Every level ends with a project you'd show someone; sharing later |
| **Books: Edwards, Dodson, Loomis** | *Drawing on the Right Side of the Brain*: upside-down copying, negative space, pure and modified contour. *Keys to Drawing*: restated lines, blind contour, "draw what you see, not what you know". | A method that makes non-artists draw in a week | The **seeing exercises**: they aren't tracing, and they are the part that makes the rest transfer |
| **Peter Han, Dynamic Sketching** | Eight weeks; week one is pure warm-up: straight lines, circles, ellipses, spirals, then forms. | Mark-making discipline | The daily warm-up set |
| **Line of Action, Quickposes, SketchDaily, Inktober** | Free timers and references: 30-second to 2-minute gestures, "five minutes of 30-second gestures every day", daily and monthly prompts. | A reason to draw today | Timed sessions and a daily prompt |

Seven threads run through all of it:

1. **Mark-making before accuracy.** Confident strokes first; accuracy is trained on top of them, never instead of them.
2. **Primitive drills are the scales.** Lines, ellipses, curves, every day, five minutes.
3. **Rehearse, then commit.** Ghosting is the single most repeated instruction in beginner drawing.
4. **Study and play in balance.** Drawabox's 50% rule exists because people who only drill quit.
5. **Every unit ends in a project you'd show someone.**
6. **Feedback is what people pay for.** Free curricula charge for critique; Schoolism charges double for it; Simply Draw's headline feature is AI feedback.
7. **Learning to see is half of learning to draw.** Upside-down copies and negative space work because they stop the hand drawing the symbol instead of the shape.

## 3. The learn-to-draw apps

| App | Loop | Feedback | Business | Weak spot |
| --- | --- | --- | --- | --- |
| **Simply Draw** (Simply, the Simply Piano company) | Video draw-along on paper → photograph → AI checks it against the lesson; a personalised path; new sessions weekly | After the fact, coarse: did the drawing follow the lesson | Reported around $3M a month; $9.99–14.99 a month or $89.99 a year | Paper only; the feedback can't see the stroke, only the result |
| **Sketchar** | AR outline projected onto paper, 750+ lessons, a Growth Plan, quizzes, mini-games, achievements | Completion | $9.99 a month, $35–50 a year | Its own reviews say it: tracing isn't learning |
| **Dro** (iPad) | Guided prompts, instant feedback, XP, streaks, leaderboards; the closest "Duolingo for drawing" | Prompt-level | Free with purchases | Not stroke-level |
| **Da Vinci Eye, ArtLoop** | AR tracing, value breakdowns, timed challenges | None on the mark | Subscription | Tracing |
| **Procreate and its course ecosystem** | The tool teaches nothing; learning lives on Domestika and YouTube (a 37-lesson "Procreate for Beginners" is typical) | None | Courses | No loop |
| **Line of Action, Quickposes** | Timers and references | None | Free, donations | No feedback |

**Our position.** Nobody measures the stroke as it's made. We have pressure, speed, tilt
and steadiness from a real brush engine at 120 Hz, which is exactly what Yousician has
from the microphone: pitch and timing per note. Simply Draw is Simply Piano's model
applied to paper; we apply Yousician's model to the digital stroke. That's the claim,
and the whole plan serves it.

## 4. What motor-learning research says

- **The guidance hypothesis.** Feedback that is frequent and easy to use, and guides
  that hold the hand (visual or haptic), improve performance *during* practice and hurt
  retention afterwards, because the learner leans on them. Handwriting studies find the
  same for on-screen guides.
- **Bandwidth feedback.** Give the specific correction only when performance falls
  outside a tolerance band; otherwise a plain "good". It increases movement consistency
  compared with feedback on every trial.
- **Faded knowledge of results.** High-frequency feedback early, reduced later, gives
  better retention and transfer than constant feedback.
- **Variability of practice.** Randomised positions, sizes and directions transfer
  better than the same stroke in the same place.
- **Plateaus are where people quit.** The reasons beginners give: no visible progress,
  comparison with others, perfectionism, information overload, no time.

What this changes in the plan: guides fade by design (assist tiers), the feedback pill
only speaks when a dimension is out of band, Perform gives no per-stroke words at all and
saves its critique for the end, trainers randomise, and the app shows change over time
rather than a number.

## 5. Where our practice mode is today

Five pieces (Warm-up waves, Leaf, Bamboo, Hills at dusk, Bloom), 5 to 26 reference
strokes each, traced stroke by stroke. Each stroke is scored on position, length and
direction, accepted at 30, and a lesson ends with a mean score, stars at 35 / 65 / 85,
and a personal best. A road-and-centreline guide, a start dot, an arrowhead, a coaching
hint per step, an in-lesson streak, and a result card with Next.

What's missing, in the order it matters:

1. **There are no skills.** A lesson teaches "a leaf", not "pressure control". Every lesson is a final exam.
2. **The score ignores what makes a mark good in this engine.** Pressure profile, speed and steadiness decide how the bristle, wash, spray and nib look; we score none of them. Reference strokes already carry pressure; points carry no timestamps, so speed can't be scored yet.
3. **No ramp.** A beginner meets 26-stroke Bloom with the same assist as the warm-up.
4. **Everything is tracing.** No seeing exercises, no freehand, no warm-up ritual.
5. **No habit loop.** No daily goal, no streak across days, no reason to come back.
6. **Everything is visible from second zero.** Four style tabs, eleven brushes, a code editor and filters face someone who hasn't drawn a line.
7. **The end screen has no breakdown.** "Rough" and "Okay" judge without instructing.

## 6. Learning model

### Skills

| Skill | What it means here | Where the engine shows it |
| --- | --- | --- |
| Line | A steady pull, straight or curved, that lands where intended | Every brush |
| Confidence | One pull, no hesitation, no chicken-scratch, rehearsed first | Every brush; the most visible quality of a beginner's line |
| Start and stop | Tapering in and lifting off | Bristle fade, nib entry |
| Pressure | Sustain, swell, fade along the stroke | Nib thick/thin, bristle density, wash weight |
| Speed | Even speed; knowing when to flick and when to pull | Spray density, wash bleed, chunk texture |
| Direction and angle | Stroke direction and pen lean change the mark | Chisel, flat shader, calligraphy nib, tilt |
| Shape | Circles, ellipses, S-curves, loops that close | Liner, graphite |
| Seeing | Drawing the shape in front of you, not the symbol in your head | Contour, negative space, upside-down copies |
| Repetition | Parallel strokes, hatching, evenly spaced rhythm | Hatching, grass, feathers |
| Layering | Order and overlap: washes first, light before dark | Wash over wash, spray over wash |
| Composition | A whole piece, from a reference, with a brush you chose | Freehand pieces |

### Structure

**Level → Mission → three parts**, plus a standing warm-up.

- **Warm-up** (3–5 min, every day, from Level 1 on): the Han / Drawabox set as trainers
  with fresh random layouts: lines between two dots, superimposed lines, ghosted lines,
  ellipses in planes, spirals, funnels. Scored for confidence first, accuracy second.
  Counts toward the daily goal. This is the five minutes of 30-second gestures.
- **Trainer** (60–90 s): 6–12 procedurally generated repetitions of one stroke type,
  random positions, same demand, scored the instant the pen lifts. Where the feedback
  words do their work.
- **Guided piece** (2–4 min): a short drawing traced with the full guide. Today's format.
- **Perform** (2–4 min): the same piece with the guide stepped down, no per-stroke
  words, a critique at the end. Only Perform awards stars and points. Proko's two
  difficulty levels per assignment; Yousician's Practice vs Play.

Missions open in order inside a level; levels are open. Skipping ahead is a test:
perform the level's final piece at two stars and the level is marked done.

**Ghosting is measurable.** A hovering Pencil (M2 iPads and later) shows us rehearsal
passes. Trainers can ask for "ghost it twice, then draw" and confirm it happened; on
devices without hover, a ghost is a stroke drawn with the ink hidden. Either way it turns
the most repeated instruction in drawing education into something the app can see.

### The path

Seven levels, twenty-seven missions. Each mission is skill · brush · piece. The pass
condition for a level is two stars on its final Perform.

| Level | Theme | Missions | Pass |
| --- | --- | --- | --- |
| 0 | Hold the pen (first launch, 3 min) | 0.1 Three strokes · liner · none. Pull a line, draw a curve, press and release. Pressure range measured silently and used to calibrate. | Complete |
| 1 | Lines | 1.1 Dot to dot · liner · **Fence** (superimposed and ghosted lines as the trainer)  ·  1.2 Curves and waves · liner · **Warm-up waves** (existing)  ·  1.3 Corners · graphite · **Mountains**  ·  1.4 Start at the dot · liner · **Kite strings** (direction scored) | 2★ on 1.4 |
| 2 | Pressure | 2.1 Taper out · bristle · **Grass**  ·  2.2 Swell · nib · **Rain**  ·  2.3 Thick and thin · nib · **Bamboo** (existing)  ·  2.4 Fade and lift · bristle · **Reeds** | 2★ on 2.3 |
| 3 | Shape and direction | 3.1 Ellipses in planes · graphite · **Pebbles**  ·  3.2 S-curves and spirals · liner · **Vine**  ·  3.3 The angled tip · chisel · **Ribbon**  ·  3.4 Lean and roll · calligraphy nib · **Feather**  ·  3.5 Outline over wash · wash + liner · **Leaf** (existing) | 2★ on 3.5 |
| 4 | Seeing (new: none of these are tracing) | 4.1 Blind contour · liner · **Hand** (the ink is hidden until you lift; a digital advantage over paper)  ·  4.2 Negative space · wash · **Chair** (paint the space around it)  ·  4.3 Upside-down copy · graphite · **Portrait line** (the reference is flipped)  ·  4.4 From memory · liner · **Cup** (ten seconds to look, then it's gone) | 2★ on 4.3 |
| 5 | Value and layering | 5.1 Flat bands · wash · **Sea bands**  ·  5.2 Light before dark · wash · **Stones**  ·  5.3 Spray and soft edges · spray · **Moon**  ·  5.4 Hatching rhythm · ballpoint · **Cube**  ·  5.5 Layered ridges · bristle · **Hills at dusk** (existing) | 2★ on 5.5 |
| 6 | Compose | 6.1 Petals and centre · wash + chisel · **Bloom** (existing)  ·  6.2 Living line · brush pen · **Koi**  ·  6.3 From a reference · your brush · **Teacup** (freehand: silhouette match, no trace)  ·  6.4 Piece of the week · any · rotating | 2★ on 6.3 |

Seeing missions are scored on shape match with a wide tolerance and no direction term;
Mission 6.3 on silhouette coverage and stroke count, brush chosen by the user. That
mission is what the path earns.

**Volume challenges** sit beside the path, Drawabox-style: 250 lines, 100 ellipses, 50
blind contours, 1,000 pencil strokes. Long milestones for the people who like them.

## 7. Scoring and feedback

### Dimensions

Per stroke, from the existing `scoreTrace` plus three new terms:

| Dimension | Signal | Needs |
| --- | --- | --- |
| Shape | coverage 0.6 + precision 0.4 against tolerance (exists) | — |
| Length | user / reference length (exists) | — |
| Direction | start at the dot; reversed detection (exists) | — |
| Pressure | mean absolute difference between the user's `p` profile and the reference's, resampled to 48 | reference `p` (exists); off for fingers and mice |
| Speed | mean speed vs target, plus a rushed / dragged sign | timestamps: an optional `t` on `Point` (ms from stroke start, delta-coded) |
| Confidence | one pull: no stalls or direction reversals along the path, low lateral jitter, a ghost pass seen first when the device can see it | timestamps and conditioned points |

Weights: a trainer puts 0.5 on its own skill's dimension; the warm-up puts 0.5 on
confidence; a guided piece puts 0.5 on shape; Perform weights all evenly; seeing missions
use shape only.

### Feedback schedule (bandwidth, then faded)

| Mode | What the pill does |
| --- | --- |
| Warm-up and trainers | Every stroke. An instruction only when a dimension is outside its band; otherwise "Clean" and the number. |
| Guided piece | Every stroke, same rule, and the band widens as the tier drops. |
| Perform | Nothing per stroke except the number. The critique comes at the end. |

### Feedback words

Always an instruction, taken from the worst out-of-band dimension:

| Dimension | Too little | Too much |
| --- | --- | --- |
| Shape | Drifted (arrow toward the line) | — |
| Length | Too short | Too long |
| Direction | Start at the dot | — |
| Pressure | Press harder (start / middle / end) | Lighter |
| Speed | Faster | Slower |
| Confidence | Hesitated: ghost it, then one pull | — |
| In band | Clean · Great · Perfect (≥ 70 / 85 / 95) | |

### The critique (what people pay for)

After a Perform: your strokes over the reference, the three most costly strokes
highlighted with one note each, the dimension that cost the most across the piece, and a
**then vs now**: your first attempt at this piece replayed beside today's. We store every
stroke, so this costs nothing and it is the single best answer to the plateau.

### Stars, points, personal bests

- Stars for a Perform: mean ≥ 50 → 1★, ≥ 70 → 2★, ≥ 85 and no skipped stroke → 3★.
- Guided pieces keep accepting at 30; Perform accepts at 50, below that the stroke is erased and retried, three tries at most.
- Points: 10 × score per stroke, streak multiplier up to ×2 after five strokes ≥ 80. Points feed a hand level, shown only on the progress screen.
- Personal best per mission, per assist tier.

### Assist tiers (our tempo slider)

| Tier | What's shown |
| --- | --- |
| Full | Road, centreline, start dot, arrow, ghost of remaining strokes |
| Light | Centreline and start dot |
| Dots | Start and end dots only |
| Blind | Nothing until the pen lifts, then the reference appears over your stroke |

Auto-adjust: two strokes ≥ 85 step the tier down; two misses step it up and offer "Loop
this stroke" (three more tries). Perform starts one tier below where the guided run
ended. The dash flow along the centreline already exists; its speed becomes the target
and it turns into a **speed ghost** for the pen to follow.

## 8. Progressive disclosure of the app

| Moment | What's visible | What appears |
| --- | --- | --- |
| First launch | Canvas, Brush, Undo, Lessons. No welcome card. Mission 0.1 starts after one tap on "Start" (or "Just draw" to skip). | — |
| After 0.1 | + Eraser, Export, the Style tab with brushes met so far marked "new", the warm-up | Coach mark: "Your brushes live here" |
| After 1.4 (Level 1 done) | + Size and opacity, colour swatches | — |
| After 2.1 (first pressure mission) | + Brush tab (weight, pressure curve) | Coach mark on the pressure curve |
| First pen with tilt data | + Pencil tab | Coach mark: "Your Pencil's tilt is on" |
| After Level 5 | + Code tab, Brush Maker link, sample stroke | — |
| Anytime | Menu → "Show all tools" flips everything on, persisted | — |

Rules: one coach mark at a time, only at the moment the feature becomes relevant, never
on a keyboard action, dismissable by drawing. Existing users (any saved drawing or
progress) start with everything on.

### Home and "Today"

The practice picker becomes a **Path** screen: levels as rows, missions as nodes, stars
under each, the next mission highlighted. Above it a **Today** strip: the warm-up,
continue where you left off, the piece of the week, the daily goal ring, and, once the
goal is half met, "Now draw something of your own" (the 50% rule, built in).

## 9. Habit loop

- **Daily goal**: 5 minutes (default) or 3 stars. Free drawing counts for up to half of
  it; lessons and warm-up count for all of it. A ring on the dock fills during the day;
  completing it is the one celebration per day.
- **Streak**: consecutive days with the goal met, one free freeze a week so a missed day
  doesn't reset to zero.
- **Then vs now**: every piece keeps your first attempt; the progress screen and the
  critique replay it beside your latest. Visible progress is the plateau's only cure.
- **Piece of the week**: one piece for everyone, best score kept per week. Without a
  backend, your best this week vs last; with one, a leaderboard (My level / Everyone /
  Friends).
- **Volume challenges and achievements**: 250 lines, 100 ellipses, first 3★, all brushes
  met, 7-day streak, first blind Perform. Quiet, on the progress screen.
- **Reminders**: ask for notification permission after the second day's goal, at the
  moment of the win, never on first launch.
- **Progress screen**: skill radar (Line, Confidence, Pressure, Shape, Seeing, Layering),
  stars per level, minutes practised, hand level, then-vs-now pairs.

### Business model signals

Yousician and Simply both cap free play per day and sell the loop. The equivalent here:
free tier is the warm-up, Levels 0–1, and unlimited free drawing; premium is the full
path, critiques, then-vs-now and the piece of the week. Feedback is the thing to charge
for; the canvas is not.

## 10. Data and code mapping

- `Point`: optional `t` (ms since stroke start); serialised delta-coded under key `t`.
  Reference strokes gain a speed profile generated with the geometry helpers.
- New types in `src/practice`: `Skill`, `Trainer` (generator + demand), `Mission`
  (`trainer`, `piece`, `skill`, `brush`, `kind: 'trace' | 'seeing' | 'free'`), `Level`,
  `Warmup`. Existing `Lesson`s become pieces.
- `scoreTrace` returns `dims` (shape, length, direction, pressure, speed, confidence), a
  `band` verdict per dimension and a `tip`. Weights per mode. Seeing missions use a
  shape-only scorer with a flipped or hidden reference; 6.3 uses silhouette coverage.
- Hover: the existing hover footprint already sees a hovering Pencil; record hover passes
  during trainers as ghost strokes.
- Progress v2: per mission `{ stars, best, plays, tier, firstAttempt }`; `daily { date,
  stars, minutes, freeMinutes }`; `streak { count, lastDay, freezes }`; `disclosure
  { stage, showAll }`; challenges and achievements. Migrate v1 personal bests onto the
  matching pieces.
- `PracticeGuide`: assist tiers, the speed ghost, hidden-ink mode for blind contour.
  `PracticePanel`: pill with ring and word, silent in Perform. New `PathScreen`,
  `MissionSheet` (Practice / Perform), `Critique`, `ProgressScreen`, `Warmup`.
- Pieces stay cheap: one function per piece over `spline`, `circle`, `frame` and the
  profiles; trainers and the warm-up are generators, not data.

## 11. Roadmap

| Phase | Scope | Size |
| --- | --- | --- |
| 1 · Core loop | Timestamps, scoring dimensions with bandwidth feedback, trainers and the warm-up, missions and the Path screen, assist tiers with auto-adjust, Perform mode with the end critique, Levels 0–2 content | ~2 weeks |
| 2 · Habit | Daily goal and ring with the 50% rule, streak with freeze, Today strip, then-vs-now, progress screen, challenges and achievements | ~1 week |
| 3 · Disclosure | Staged tools and tabs, coach marks, "Show all tools", first launch into Mission 0.1 | ~1 week |
| 4 · Content | Levels 3–6: twenty new pieces, the four seeing modes (hidden ink, negative space, flipped reference, timed reference), silhouette scoring for 6.3, piece-of-the-week rotation | ~2 weeks |
| 5 · Community (needs a backend) | Accounts, leaderboards, friends, share cards, a feed for finished pieces | later |

Metrics to keep locally from day one: sessions per week, missions per session, median
session length (target 5–10 min), share of users reaching Level 2 and Level 4, warm-up
completion rate, free-drawing minutes per day, and the 3★ rate per mission (20–40% is
the healthy band; higher means the mission is too easy).

### Update: the teaching layer (shipped)

Phase 1 shipped the structure but the missions only measured. The teaching layer adds
a **Lesson** part before every trainer: slides with the concept, the reason it matters
for this brush, a physical cue, and engine-drawn demos of the right and wrong way. The
cue is repeated inside the session; drills report the focus dimension; the guide's
road follows the reference pressure; 1.1 became superimposed lines. See
`practice-ux.md`, "v3: lessons that teach".

## 12. Risks and how the plan handles them

- **Tracing isn't drawing.** Level 4 is not tracing at all, Perform fades the guide,
  6.3 is freehand, and the 50% rule makes free drawing part of the goal. Free drawing
  outside lessons is never scored.
- **Feedback that teaches dependence.** Bandwidth and faded schedules, silent Perform,
  and tiers that step down on success are the research's answer, built in.
- **Fingers and mice have no pressure.** Pressure and tilt dimensions switch off and the
  pill says so once; the score is over the remaining dimensions.
- **Artists don't want a slot machine.** Celebrations stay rare (the daily goal, a new
  best, three stars), a "quiet mode" hides points and streaks, and nothing blocks free
  drawing.
- **Content cost.** Trainers and the warm-up are procedural. Each piece is one function;
  twenty pieces is about two weeks, and the geometry helpers already exist.

Sources: Yousician support articles on the learning path, practice and play modes, song
scoring and leaderboards, the 30-day challenge and the song end screen; Yousician's 2021
syllabus post; StriveCloud's and Trophy's gamification case studies; Yu-kai Chou on
recovery-first streaks; Duolingo onboarding teardowns (Appcues, Juno School, Relaunch);
Drawabox Lesson 0 and 1 and community critiques; Proko's Drawing Basics and Figure
Drawing Fundamentals course pages and reviews (Concept Art Empire, Art School Database);
comparisons of New Masters Academy, Schoolism, Domestika and Skillshare (Concept Art
Empire, Art Ignition, Course Reviewers); Betty Edwards' drawright.com and reviews of
*Drawing on the Right Side of the Brain*; Bert Dodson's *Keys to Drawing*; Peter Han's
Dynamic Sketching (CGMA reviews, Proko's Straight Line Discipline); Line of Action and
Quickposes practice guides; Simply Draw store pages, Research.com review and the 36Kr
revenue report; Sketchar's site and ARCritic review; Dro's App Store listing; motor
learning literature on the guidance hypothesis, bandwidth knowledge of results and faded
feedback (Lee and Carnahan 1990; PMC studies on gymnastic and postural tasks; J. Phys.
Ther. Sci. 2019); surveys of why beginners quit drawing (Luuk Minkman, Creative Axis).
