import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { store } from './lib/store.svelte';
import { applyTheme, watchSystemTheme } from './lib/theme';

applyTheme(store.theme);
watchSystemTheme(() => store.theme);

const app = mount(App, { target: document.getElementById('app')! });

// オフライン起動用の Service Worker（開発時は登録しない）
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* 登録に失敗してもアプリは動作する */
    });
  });
}

export default app;
