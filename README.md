# BrickBreaker CUBED
Code Repository for a brickbraker game with a twist.

Based on brickbraker by codingtrain


### Play the game!
* https://codingtrain.github.io/BrickBreaker


---

## p5.brush Realtime Studio

`p5brush-studio/` is a real-time freehand drawing canvas rendered by the actual
[p5.brush](https://github.com/acamposuribe/p5.brush) 2.2.2 engine (standalone build,
installed from npm). Strokes drawn with a mouse, finger or Apple Pencil are turned into
`brush.Plot`s and stamped by p5.brush with the registered custom brush, so the result
matches `brush.line()` / `brush.spline()` in a p5 sketch.

Built with Vite, React, TypeScript, Tailwind CSS and shadcn/ui, with a tldraw-inspired
interface: tool dock at the bottom, quick actions top-left, style panel top-right.

```bash
cd p5brush-studio
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
npm test         # headless regression suite against dist/ (needs `npx playwright install chromium` once)
```

The canvas is infinite: pinch to zoom and drag with two fingers to pan (with Pencil-only on,
one finger pans and the Pencil draws; the first Apple Pencil touch turns Pencil-only on),
two-finger tap undoes, three-finger tap redoes. On a desktop, scroll pans, pinch or
ctrl-scroll zooms at the cursor, middle-drag or space-drag pans, `0` resets and `F` fits
the drawing. Strokes are stored in world units, so zooming re-renders them exactly.

Input is conditioned the way tldraw does it: pen and finger samples closer than a screen
pixel are folded into the previous point (keeping the higher pressure), the first few jittery
samples of a stroke are dropped, pen pressure is eased in instead of starting on the raw
spike, and finger and mouse strokes get simulated pressure from speed (slow is heavier).
Conditioning runs at render time from the stored input kind, so old drawings are untouched.
When the canvas is rebuilt (undo, zoom, reload) strokes outside the viewport are skipped.
Hand-drawn strokes are stamped chunk by chunk as they arrive and committed exactly as
previewed: the chunk boundaries are stored with the stroke, so undo, zoom, reload and the
sketch export replay the identical stamps and nothing changes when the pen lifts. All
chunks of a stroke share one engine mask and are mixed with the image from before the
stroke, so a chunk boundary leaves no mark in the ink.

### Pencil

The Pencil tab of the style panel holds the input smoothing (Kalman filters on position,
pressure, tilt and roll, with one-tap presets and the q/r parameters under Advanced), the
hover footprint, the predicted tail and a pressure calibration. Nib direction ("tip follows
stroke" or "pencil lean", like a broad nib) and Pencil Pro barrel roll belong to the brush
and sit in the Brush tab; brush presets bring their own: the calligraphy nib and the flat
shader turn with the pencil, the ballpoint uses responsive smoothing, the brush pen keeps
force changes light. Pen samples record altitude, azimuth and twist, and every stroke keeps
the effects and filter parameters it was drawn with, so replays never depend on the current
settings. A record without parameters replays with the pre-filter behaviour.

Eleven brush presets ship: chisel marker, fine liner, graphite pencil, watercolor wash,
calligraphy nib, dry bristle, brush pen, flat shader, ballpoint, charcoal stick and spray
stipple.

On a phone the same interface rearranges itself: the style panel becomes a bottom sheet
that slides up under the dock (drag the handle down, or flick it, to close), the practice
picker and help open as sheets too, the help button moves into the main menu, and fixed
chrome keeps clear of the notch and the home indicator. Touch targets grow on touch-first
devices and hover styles apply only where a pointer can hover. Held sideways, the lesson
card moves to a left column so the drawing keeps the height.

Motion follows one small set of rules: keyboard shortcuts (`P`, `L`, `?`, `Esc`) change
the interface with no animation, popovers and tooltips scale out of the control that opened
them and open instantly once one is showing, presses squeeze the button by 3%, and only the
rare moments (a lesson card appearing, the stars at the end) spend any motion beyond that.
Reduced-motion settings keep the fades and drop the movement; hover styles only apply where
a pointer can actually hover, so a tap on the iPad never leaves a stuck highlight.

### Pencil lab

Experimental features stay behind switches in the Pencil lab: tilt shading (a flat pencil
makes a wider, lighter mark), the raw-input overlay and the full per-channel filter card.
Open the lab with `?lab=1` (or `#lab`) in the URL, or build it in with `VITE_PENCIL_LAB=1`.

Practice mode (`L`, or the graduation-cap button) is a gamified way to learn the brushes:
pick one of the sample drawings (warm-up waves, leaf, bamboo, hills at dusk, bloom; the
thumbnails are rendered by the engine) and trace it stroke by stroke. Each step sets the
brush, size and colour for you, shows a coaching hint, and highlights the stroke to draw
with a flowing dashed line, a start dot and an arrowhead. Every stroke is scored on shape,
size and direction against the reference: good strokes advance, strokes far off the mark
are removed so you can try again, Skip counts a step as zero and Undo reopens it. A lesson
ends with stars (1 to 3), a score out of 100 and a per-step bar, with your best kept per
lesson. Your own drawing is set aside while a lesson is open (autosave keeps saving it) and
comes back when you leave; you can also keep the traced drawing instead. Lessons live in
`src/practice/lessons.ts` as ordered brush steps built from deterministic splines.

WebGL2 is required. Pick one of the brush templates (chisel marker, fine liner,
graphite pencil, watercolor wash, calligraphy nib, dry bristle, spray stipple; previews are
rendered by the engine itself), edit the `brush.add(...)` parameters live, paste a spec from
the Brush Maker, and copy the drawing back out as a p5.js sketch. The drawing and settings
autosave in the browser (localStorage) and are restored on the next visit; New sketch (C)
starts over with an empty drawing and history (Undo right after brings the previous
sketch back, until the next stroke),
Escape cancels the stroke in progress, and a size cursor shows the brush or
eraser footprint.

Layout: `src/engine/` holds the framework-free engine (`Studio.ts` drives p5.brush,
`StudioGL.ts` adds paper/snapshots/eraser, `records.ts` holds stroke records and geometry,
`tipShim.ts` emulates the p5.Graphics tip surface); `src/components/` is the React UI.
