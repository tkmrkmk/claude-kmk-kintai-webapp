/** 勤怠区分。Excel `年間入力シート` C列の入力規則と完全一致させること。 */
export const DAY_TYPES = [
  '通常勤務',
  '休日勤務',
  '午前半休',
  '午後半休',
  '休暇',
  '振休',
  'その他休'
] as const;

export type DayType = (typeof DAY_TYPES)[number];

/** 出勤扱い（開始・終了・休憩を入力する）区分 */
export const WORKING_TYPES: readonly DayType[] = [
  '通常勤務',
  '休日勤務',
  '午前半休',
  '午後半休',
  '振休'
];

/** 1日分の勤怠。各フィールドは `年間入力シート` の列に1対1で対応する。 */
export interface DayEntry {
  /** C列: 勤怠区分 */
  type: DayType;
  /** D列: 開始 `H:mm` */
  start: string;
  /** E列: 終了 `H:mm` */
  end: string;
  /** F列: 休憩 `H:mm` */
  break: string;
  /** H列: 作業内容(作業場所) */
  work: string;
  /** K列: 備考 */
  note: string;
}

export interface WorkPattern {
  start: string;
  end: string;
  break: string;
}

export interface Settings {
  defaultPattern: WorkPattern;
  presets: {
    work: string[];
    note: string[];
  };
}

export interface FiscalData {
  fiscalYear: number;
  settings: Settings;
  /** キーは `YYYY-MM-DD`。未入力日はキーを持たない。 */
  days: Record<string, DayEntry>;
}

export function emptyEntry(type: DayType = '通常勤務'): DayEntry {
  return { type, start: '', end: '', break: '', work: '', note: '' };
}

export function isEmptyEntry(e: DayEntry | undefined): boolean {
  if (!e) return true;
  return !e.start && !e.end && !e.break && !e.work.trim() && !e.note.trim();
}

export function defaultSettings(): Settings {
  return {
    defaultPattern: { start: '9:30', end: '18:30', break: '1:00' },
    presets: {
      work: ['AIプロダクト（自宅）', 'AIプロダクト（本社）'],
      note: ['★草加↔築地']
    }
  };
}

export function defaultData(fiscalYear: number): FiscalData {
  return { fiscalYear, settings: defaultSettings(), days: {} };
}
