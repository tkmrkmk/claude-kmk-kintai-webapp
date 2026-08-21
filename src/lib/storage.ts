import { defaultData, defaultSettings, type DayEntry, type FiscalData, DAY_TYPES } from './types';

const PREFIX = 'kintai:';

export function storageKey(fiscalYear: number): string {
  return `${PREFIX}${fiscalYear}`;
}

/** LocalStorage が使えるか（プライベートモード等で例外になる環境がある） */
export function storageAvailable(): boolean {
  try {
    const probe = `${PREFIX}__probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** 保存済み年度の一覧 */
export function savedFiscalYears(): number[] {
  const years: number[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) {
        const year = Number(key.slice(PREFIX.length));
        if (Number.isInteger(year)) years.push(year);
      }
    }
  } catch {
    /* 利用不可なら空 */
  }
  return years.sort((a, b) => a - b);
}

/** 外部由来のJSONを検証しつつ FiscalData に落とし込む */
export function normalizeData(input: unknown, fallbackYear: number): FiscalData {
  const data = defaultData(fallbackYear);
  if (!input || typeof input !== 'object') return data;
  const raw = input as Record<string, unknown>;

  if (Number.isInteger(raw.fiscalYear)) data.fiscalYear = raw.fiscalYear as number;

  const settings = raw.settings as Record<string, unknown> | undefined;
  if (settings) {
    const base = defaultSettings();
    const pattern = settings.defaultPattern as Record<string, unknown> | undefined;
    data.settings.defaultPattern = {
      start: typeof pattern?.start === 'string' ? pattern.start : base.defaultPattern.start,
      end: typeof pattern?.end === 'string' ? pattern.end : base.defaultPattern.end,
      break: typeof pattern?.break === 'string' ? pattern.break : base.defaultPattern.break
    };
    const presets = settings.presets as Record<string, unknown> | undefined;
    data.settings.presets = {
      work: Array.isArray(presets?.work) ? presets.work.filter((v) => typeof v === 'string') : base.presets.work,
      note: Array.isArray(presets?.note) ? presets.note.filter((v) => typeof v === 'string') : base.presets.note
    };
    data.settings.carryOver =
      typeof settings.carryOver === 'string' ? settings.carryOver : base.carryOver;
  }

  const days = raw.days as Record<string, unknown> | undefined;
  if (days && typeof days === 'object') {
    for (const [key, value] of Object.entries(days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !value || typeof value !== 'object') continue;
      const v = value as Record<string, unknown>;
      const type = DAY_TYPES.includes(v.type as never) ? (v.type as DayEntry['type']) : '通常勤務';
      data.days[key] = {
        type,
        start: typeof v.start === 'string' ? v.start : '',
        end: typeof v.end === 'string' ? v.end : '',
        break: typeof v.break === 'string' ? v.break : '',
        work: typeof v.work === 'string' ? v.work : '',
        note: typeof v.note === 'string' ? v.note : ''
      };
    }
  }

  return data;
}

export function load(fiscalYear: number): FiscalData {
  try {
    const raw = localStorage.getItem(storageKey(fiscalYear));
    if (!raw) return defaultData(fiscalYear);
    const data = normalizeData(JSON.parse(raw), fiscalYear);
    data.fiscalYear = fiscalYear;
    return data;
  } catch {
    return defaultData(fiscalYear);
  }
}

export function save(data: FiscalData): boolean {
  try {
    localStorage.setItem(storageKey(data.fiscalYear), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function remove(fiscalYear: number): void {
  try {
    localStorage.removeItem(storageKey(fiscalYear));
  } catch {
    /* 何もしない */
  }
}

export function defaultDataFor(fiscalYear: number): FiscalData {
  return defaultData(fiscalYear);
}
