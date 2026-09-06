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
      return { code: code.replace(re, 'isInCanvas(){return true}'), map: null };
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
