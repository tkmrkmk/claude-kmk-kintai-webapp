import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, posix, relative, resolve, sep } from 'node:path';
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const SW_FILE = 'sw.js';

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

function renderServiceWorker(precache: string[]): string {
  return `// build 時に自動生成。編集しないこと。
const CACHE = 'kintai-${Date.now().toString(36)}';
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // ナビゲーションはネットワーク優先・失敗時は index.html（オフライン起動）
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html').then((r) => r || Response.error()))
    );
    return;
  }

  // ハッシュ付きアセットはキャッシュ優先
  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
    )
  );
});
`;
}

/**
 * ビルド成果物の一覧から Service Worker を生成する。
 * workbox 等の依存を持ち込まず、アセットのプリキャッシュだけを行う。
 */
function serviceWorker(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'kintai-service-worker',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle() {
      const outDir = resolve(config.root, config.build.outDir);
      mkdirSync(outDir, { recursive: true });
      const files = listFiles(outDir)
        .map((file) => `./${relative(outDir, file).split(sep).join(posix.sep)}`)
        .filter((file) => file !== `./${SW_FILE}` && !file.endsWith('.map'));
      const precache = ['./', ...files];
      writeFileSync(join(outDir, SW_FILE), renderServiceWorker(precache), 'utf8');
    }
  };
}

export default defineConfig({
  // GitHub Pages 等のサブディレクトリ配信でもそのまま動くよう相対パスにする
  base: './',
  plugins: [svelte(), serviceWorker()],
  build: {
    target: 'es2022',
    cssCodeSplit: false
  }
});
