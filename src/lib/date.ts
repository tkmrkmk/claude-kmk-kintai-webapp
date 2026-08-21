/** 日付ユーティリティ。標準の Date / Intl のみを使う。 */

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** ローカル日付から `YYYY-MM-DD` を作る（UTCずれを避けるため toISOString は使わない） */
export function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function makeKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function todayKey(): string {
  return toKey(new Date());
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** 2つの日付の日数差（a - b）。時刻成分は無視する。 */
export function diffDays(a: Date, b: Date): number {
  const ms =
    Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) -
    Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round(ms / 86_400_000);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function weekdayLabel(date: Date): string {
  return WEEKDAYS[date.getDay()];
}

export function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

/** 年度の開始日（4/1）・終了日（翌年3/31） */
export function fiscalStart(fiscalYear: number): Date {
  return new Date(fiscalYear, 3, 1);
}

export function fiscalEnd(fiscalYear: number): Date {
  return new Date(fiscalYear + 1, 2, 31);
}

export function inFiscalYear(key: string, fiscalYear: number): boolean {
  const d = fromKey(key);
  return d >= fiscalStart(fiscalYear) && d <= fiscalEnd(fiscalYear);
}

/** 日付が属する年度 */
export function fiscalYearOf(date: Date): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

export interface FiscalMonth {
  /** 暦年 */
  year: number;
  /** 暦月 1-12 */
  month: number;
  /** `4月度` */
  label: string;
}

/** 年度の12か月（4月度〜3月度）を順に返す */
export function fiscalMonths(fiscalYear: number): FiscalMonth[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = ((3 + i) % 12) + 1;
    const year = i < 9 ? fiscalYear : fiscalYear + 1;
    return { year, month, label: `${month}月度` };
  });
}

/** `2026/5/12(火)` 形式 */
export function formatDisplay(key: string): string {
  const d = fromKey(key);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${weekdayLabel(d)})`;
}

/** `5/12(火)` 形式 */
export function formatShort(key: string): string {
  const d = fromKey(key);
  return `${d.getMonth() + 1}/${d.getDate()}(${weekdayLabel(d)})`;
}
