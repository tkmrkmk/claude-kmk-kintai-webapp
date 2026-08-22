/**
 * 配色テーマ。値は LocalStorage の UI 設定（`kintai:ui`）に年度と一緒に保存する。
 * 実際の色は `app.css` の `light-dark()` が `color-scheme` を見て解決するため、
 * ここでは html 要素の `data-theme` 属性だけを切り替える。
 */
export const THEMES = ['system', 'light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  system: '端末の設定',
  light: 'ライト',
  dark: 'ダーク'
};

/** アドレスバー等の配色（meta[name=theme-color]）。--bg と合わせる */
const THEME_COLORS: Record<'light' | 'dark', string> = {
  light: '#f1f5f9',
  dark: '#0f172a'
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/** 'system' を端末の設定で解決する */
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', THEME_COLORS[resolveTheme(theme)]);
}

/** 'system' のときに端末側の切り替えへ追従させる */
export function watchSystemTheme(current: () => Theme): void {
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (current() === 'system') applyTheme('system');
    });
  } catch {
    /* 非対応環境では追従しないだけ */
  }
}
