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

Built with Vite, React, TypeScript, Tailwind CSS and shadcn/ui.

```bash
cd p5brush-studio
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

WebGL2 is required. Edit the `brush.add(...)` parameters live, paste a spec from the
Brush Maker, and copy the drawing back out as a p5.js sketch.

Layout: `src/engine/` holds the framework-free engine (`Studio.ts` drives p5.brush,
`StudioGL.ts` adds paper/snapshots/eraser, `records.ts` holds stroke records and geometry,
`tipShim.ts` emulates the p5.Graphics tip surface); `src/components/` is the React UI.
