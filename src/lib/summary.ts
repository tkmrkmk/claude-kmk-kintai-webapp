import { daysInMonth, fromKey, isWeekend, makeKey } from './date';
import { isHoliday } from './holidays';
import { workedMinutes } from './time';
import { DAY_TYPES, isEmptyEntry, type DayEntry, type DayType } from './types';
import { validateEntry, type Issue } from './validation';

export interface DaySummary {
  key: string;
  day: number;
  entry?: DayEntry;
  worked: number | null;
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
  /** 平日かつ未入力の日 */
  missing: string[];
  errors: { key: string; issue: Issue }[];
  warnings: { key: string; issue: Issue }[];
}

export function summarizeMonth(
  days: Record<string, DayEntry>,
  year: number,
  month: number
): MonthSummary {
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

    list.push({ key, day, entry, worked, restDay, issues });
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
    missing,
    errors,
    warnings
  };
}

export { isEmptyEntry };
