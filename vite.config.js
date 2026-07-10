import { defineConfig } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// sw.js のキャッシュ名プレースホルダをビルドごとに一意な値へ置換する。
// これによりデプロイのたびに Service Worker の旧キャッシュが確実に破棄される。
function swCacheVersion() {
  return {
    name: 'sw-cache-version',
    apply: 'build',
    closeBundle() {
      const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));
      const version = `v${pkg.version}-${Date.now().toString(36)}`;
      const swPath = resolve(__dirname, 'dist/sw.js');
      const src = readFileSync(swPath, 'utf8');
      writeFileSync(swPath, src.replaceAll('__CACHE_VERSION__', version));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [swCacheVersion()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
  },
});
