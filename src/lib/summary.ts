import { daysInMonth, fromKey, isWeekend, makeKey } from './date';
import { isHoliday } from './holidays';
import { parseTime, workedMinutes } from './time';
import { DAY_TYPES, isEmptyEntry, type DayEntry, type DayType } from './types';
import { validateEntry, type Issue } from './validation';

const FULL_DAY = 8 * 60;

export interface DaySummary {
  key: string;
  day: number;
  entry?: DayEntry;
  worked: number | null;
  /** その日終了時点の振休残（分） */
  balance: number;
  restDay: boolean;
  issues: Issue[];
}

export interface MonthSummary {
  year: number;
  month: number;
  days: DaySummary[];
  totalWorked: number;
  workedDays: number;
  byType: { type: DayType; count: number }[];
  /** 月初時点の振休残（分） */
  openingBalance: number;
  /** 月末時点の振休残（分） */
  closingBalance: number;
  /** 平日かつ未入力の日 */
  missing: string[];
  errors: { key: string; issue: Issue }[];
  warnings: { key: string; issue: Issue }[];
}

/**
 * 年度初日から指定日まで振休残を積み上げる（Excel O列と同じロジック）。
 * 休日勤務: +実働 / 振休(勤務あり): -8h +実働 / 振休(終日): -8h
 */
function applyBalance(prev: number, entry: DayEntry | undefined): number {
  if (!entry) return prev;
  const worked = workedMinutes(entry);
  if (entry.type === '休日勤務') return prev + (worked ?? 0);
  if (entry.type === '振休') return prev - FULL_DAY + (worked ?? 0);
  return prev;
}

/** 年度初日から対象月の前日までの振休残を求める */
export function balanceBefore(
  days: Record<string, DayEntry>,
  fiscalYear: number,
  year: number,
  month: number,
  carryOver: string
): number {
  let balance = parseTime(carryOver) ?? 0;
  const cursor = new Date(fiscalYear, 3, 1);
  const limit = new Date(year, month - 1, 1);
  while (cursor < limit) {
    const key = makeKey(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
    balance = applyBalance(balance, days[key]);
    cursor.setDate(cursor.getDate() + 1);
  }
  return balance;
}

export function summarizeMonth(
  days: Record<string, DayEntry>,
  fiscalYear: number,
  year: number,
  month: number,
  carryOver: string
): MonthSummary {
  const openingBalance = balanceBefore(days, fiscalYear, year, month, carryOver);
  let balance = openingBalance;

  const count = daysInMonth(year, month);
  const list: DaySummary[] = [];
  const missing: string[] = [];
  const errors: { key: string; issue: Issue }[] = [];
  const warnings: { key: string; issue: Issue }[] = [];
  const typeCount = new Map<DayType, number>();
  let totalWorked = 0;
  let workedDays = 0;

  for (let day = 1; day <= count; day++) {
    const key = makeKey(year, month, day);
    const entry = days[key];
    const restDay = isWeekend(fromKey(key)) || isHoliday(key);
    balance = applyBalance(balance, entry);

    const worked = entry ? workedMinutes(entry) : null;
    const issues = entry ? validateEntry(key, entry) : [];

    if (entry) {
      typeCount.set(entry.type, (typeCount.get(entry.type) ?? 0) + 1);
      if (worked !== null && worked > 0) {
        totalWorked += worked;
        workedDays++;
      }
      for (const issue of issues) {
        (issue.severity === 'error' ? errors : warnings).push({ key, issue });
      }
    } else if (!restDay) {
      missing.push(key);
    }

    list.push({ key, day, entry, worked, balance, restDay, issues });
  }

  return {
    year,
    month,
    days: list,
    totalWorked,
    workedDays,
    byType: DAY_TYPES.filter((t) => typeCount.has(t)).map((type) => ({
      type,
      count: typeCount.get(type) ?? 0
    })),
    openingBalance,
    closingBalance: balance,
    missing,
    errors,
    warnings
  };
}

export { isEmptyEntry };
