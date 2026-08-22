import { fiscalYearOf } from './date';
import * as storage from './storage';
import { applyTheme, isTheme, type Theme } from './theme';
import { isEmptyEntry, type DayEntry, type FiscalData, type Settings } from './types';

const UI_KEY = 'kintai:ui';

/** 年度・テーマなど、年度データとは別に持つUI設定 */
function loadUi(): { fiscalYear: number; theme: Theme } {
  const ui = { fiscalYear: fiscalYearOf(new Date()), theme: 'system' as Theme };
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { fiscalYear?: number; theme?: unknown };
      if (Number.isInteger(saved.fiscalYear)) ui.fiscalYear = saved.fiscalYear as number;
      if (isTheme(saved.theme)) ui.theme = saved.theme;
    }
  } catch {
    /* 既定値へフォールバック */
  }
  return ui;
}

/** アプリ全体の状態。runes で保持し、更新のたびに LocalStorage へ即時保存する。 */
class KintaiStore {
  data = $state<FiscalData>(storage.defaultDataFor(fiscalYearOf(new Date())));
  theme = $state<Theme>('system');
  /** 保存に失敗した場合のメッセージ（容量超過・プライベートモード等） */
  saveError = $state<string | null>(null);
  storageAvailable = $state(true);

  constructor() {
    this.storageAvailable = storage.storageAvailable();
    const ui = loadUi();
    this.theme = ui.theme;
    this.data = storage.load(ui.fiscalYear);
  }

  get fiscalYear(): number {
    return this.data.fiscalYear;
  }

  get days(): Record<string, DayEntry> {
    return this.data.days;
  }

  get settings(): Settings {
    return this.data.settings;
  }

  private persist(): void {
    const ok = storage.save($state.snapshot(this.data));
    this.saveError = ok ? null : '保存に失敗しました。ブラウザの保存容量や設定を確認してください。';
  }

  private persistUi(): void {
    try {
      localStorage.setItem(
        UI_KEY,
        JSON.stringify({ fiscalYear: this.data.fiscalYear, theme: this.theme })
      );
    } catch {
      /* 何もしない */
    }
  }

  setFiscalYear(fiscalYear: number): void {
    this.data = storage.load(fiscalYear);
    this.persistUi();
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    applyTheme(theme);
    this.persistUi();
  }

  getDay(key: string): DayEntry | undefined {
    return this.data.days[key];
  }

  /** 1日分を保存する。実質空（区分のみで内容なし）でも区分は記録する。 */
  setDay(key: string, entry: DayEntry): void {
    this.data.days[key] = { ...entry };
    this.persist();
  }

  deleteDay(key: string): void {
    delete this.data.days[key];
    this.persist();
  }

  /** 取り込み等で複数日をまとめて反映する */
  applyDays(entries: Record<string, DayEntry | null>): void {
    for (const [key, entry] of Object.entries(entries)) {
      if (entry === null || (isEmptyEntry(entry) && !entry.type)) delete this.data.days[key];
      else this.data.days[key] = { ...entry };
    }
    this.persist();
  }

  updateSettings(update: (settings: Settings) => void): void {
    update(this.data.settings);
    this.persist();
  }

  replaceAll(data: FiscalData): void {
    this.data = data;
    this.persist();
    this.persistUi();
  }

  clearYear(): void {
    this.data.days = {};
    this.persist();
  }

  exportJson(): string {
    return JSON.stringify($state.snapshot(this.data), null, 2);
  }
}

export const store = new KintaiStore();
