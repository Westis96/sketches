import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * p5.brush 2.2.2 stops advancing a stroke once its position leaves a margin
 * around the canvas (Position.isInCanvas). The test adds the untransformed
 * position to the matrix translation and assumes a top-left origin, so with the
 * standalone build's centred origin the allowed window is the screen plus a
 * margin to the right and bottom only: any stamp left of or above the viewport
 * freezes the rest of the stroke. With an infinite canvas that made strokes
 * vanish when zoomed in. The studio culls strokes itself and never uses flow
 * fields, so the check is neutralised here. Fails the build if the engine's
 * code no longer matches, so a version bump cannot regress silently.
 */
function p5brushInfiniteCanvas(): Plugin {
  return {
    name: 'p5brush-infinite-canvas',
    enforce: 'pre',
    transform(code, id) {
      if (!/p5\.brush[\\/]dist[\\/]brush\.esm\.js$/.test(id)) return null;
      const re = /isInCanvas\(\)\{[^}]*\}/;
      if (!re.test(code)) throw new Error('p5brush-infinite-canvas: Position.isInCanvas not found; check the p5.brush version');
      let out = code.replace(re, 'isInCanvas(){return true}');

      // Mask clears: the engine clears its full-canvas stroke mask twice per
      // brush.render(), which at iPad resolution is the largest fixed cost of a
      // live chunk and of every stroke in a rebuild. Everything drawn into the
      // mask is tracked in its dirtyRect (the composite relies on that too), so
      // clear only that rectangle, and skip the clear entirely when nothing was
      // drawn since the last one. Mask framebuffers are not y-flipped (the engine
      // composites them with flipY only for the default framebuffer).
      const clearRe = /if\((\w)\((\w)\)\)\{const (\w)=(\w)\.drawingContext,(\w)=\3\.getParameter\(\3\.FRAMEBUFFER_BINDING\),(\w)=\3\.getParameter\(\3\.VIEWPORT\);return \3\.bindFramebuffer\(\3\.FRAMEBUFFER,\2\.framebuffer\),\3\.viewport\(0,0,\2\.width\*\2\.density,\2\.height\*\2\.density\),\3\.clearColor\(0,0,0,0\),\3\.clear\(\3\.COLOR_BUFFER_BIT\),/;
      const m = clearRe.exec(out);
      if (!m) throw new Error('p5brush-infinite-canvas: mask clear not found; check the p5.brush version');
      const [, isFb, tgt, gl] = m;
      const scissored =
        `if(${isFb}(${tgt})){if(!${tgt}.dirtyRect&&${tgt}.isDrawn===false)return;` +
        `const ${gl}=${m[4]}.drawingContext,${m[5]}=${gl}.getParameter(${gl}.FRAMEBUFFER_BINDING),${m[6]}=${gl}.getParameter(${gl}.VIEWPORT);` +
        `const W=${tgt}.width*${tgt}.density,H=${tgt}.height*${tgt}.density,d=${tgt}.dirtyRect;` +
        `return ${gl}.bindFramebuffer(${gl}.FRAMEBUFFER,${tgt}.framebuffer),${gl}.viewport(0,0,W,H),${gl}.clearColor(0,0,0,0),` +
        `(d?(()=>{const x0=Math.max(0,Math.floor(d.minX-4)),x1=Math.min(W,Math.ceil(d.maxX+4)),y0=Math.max(0,Math.floor(d.minY-4)),y1=Math.min(H,Math.ceil(d.maxY+4));` +
        `if(x1>x0&&y1>y0){${gl}.enable(${gl}.SCISSOR_TEST);${gl}.scissor(x0,y0,x1-x0,y1-y0);${gl}.clear(${gl}.COLOR_BUFFER_BIT);${gl}.disable(${gl}.SCISSOR_TEST)}})():${gl}.clear(${gl}.COLOR_BUFFER_BIT)),`;
      out = out.replace(clearRe, scissored);
      return { code: out, map: null };
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [p5brushInfiniteCanvas(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Keep p5.brush out of the dev pre-bundle so the transform above applies there too.
  optimizeDeps: { exclude: ['p5.brush'] },
});
