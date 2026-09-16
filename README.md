# Sketches

Two p5.js projects: a brick breaker game and a drawing studio built on the p5.brush engine.

| Project | What it is |
| --- | --- |
| [`p5brush-studio/`](p5brush-studio/) | A real-time freehand drawing canvas rendered by the actual [p5.brush](https://github.com/acamposuribe/p5.brush) engine, with a drawing course beside it. Vite, React, TypeScript, Tailwind CSS. |
| [`brickbreaker/`](brickbreaker/) | BrickBreaker CUBED, a brick breaker with a twist, based on the [Coding Train original](https://github.com/CodingTrain/BrickBreaker). Plain p5.js, no build step. |

## Layout

```
.
├── index.html          landing page linking to both projects
├── brickbreaker/       the game: open index.html, or serve the folder
└── p5brush-studio/     the studio: npm install, npm run dev
    ├── src/            engine, course data and the React interface
    ├── docs/           curriculum plan, UX spec, gallery
    ├── tests/          headless regression suite
    └── tools/          gallery renderers
```

## The studio

```bash
cd p5brush-studio
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
npm test         # headless regression suite against dist/
```

Strokes drawn with a mouse, finger or Apple Pencil become `brush.Plot`s stamped by p5.brush, so
what lands on the paper matches `brush.line()` in a p5 sketch. A Shape tool paints p5.brush
fills, washes, hatching and massing. Beside the free canvas sits a course of nine levels, from
straight lines to the Sixteen Washes, that scores each stroke and fades its guide as you improve.

See [`p5brush-studio/README.md`](p5brush-studio/README.md) for the full description, and
[`p5brush-studio/docs/`](p5brush-studio/docs/) for the curriculum plan and the UX spec.

## The game

Open [`brickbreaker/index.html`](brickbreaker/index.html) in a browser, or serve the folder:

```bash
npx http-server brickbreaker -p 8080
```
