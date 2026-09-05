# BrickBreaker CUBED
Code Repository for a brickbraker game with a twist.

Based on brickbraker by codingtrain


### Play the game!
* https://codingtrain.github.io/BrickBreaker


---

## p5.brush Realtime Studio

`p5brush-studio/` is a real-time freehand drawing canvas rendered by the actual
[p5.brush](https://github.com/acamposuribe/p5.brush) 2.2.2 engine (standalone build,
vendored in `p5brush-studio/lib/brush.js`, MIT). Strokes drawn with a mouse, finger or
Apple Pencil are turned into `brush.Plot`s and stamped by p5.brush with the registered
custom brush, so the result matches `brush.line()` / `brush.spline()` in a p5 sketch.

* Open `p5brush-studio/index.html` from any static server (WebGL2 required).
* Edit the `brush.add(...)` parameters live, paste a spec from the Brush Maker, and
  copy the drawing back out as a p5.js sketch.
