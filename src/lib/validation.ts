import { fromKey, isWeekend } from './date';
import { isHoliday } from './holidays';
import { isQuarter, parseTime, workedMinutes } from './time';
import { WORKING_TYPES, type DayEntry } from './types';

export type Severity = 'error' | 'warn';

export interface Issue {
  severity: Severity;
  field?: keyof DayEntry;
  message: string;
}

/** 1日分の入力を検証する（要件定義 7章） */
export function validateEntry(key: string, entry: DayEntry): Issue[] {
  const issues: Issue[] = [];
  const date = fromKey(key);
  const restDay = isWeekend(date) || isHoliday(key);

  const start = parseTime(entry.start);
  const end = parseTime(entry.end);
  const brk = entry.break ? parseTime(entry.break) : 0;

  if (entry.start && start === null)
    issues.push({ severity: 'error', field: 'start', message: '開始の書式が不正です（例: 9:30）' });
  if (entry.end && end === null)
    issues.push({ severity: 'error', field: 'end', message: '終了の書式が不正です（例: 18:30）' });
  if (entry.break && brk === null)
    issues.push({ severity: 'error', field: 'break', message: '休憩の書式が不正です（例: 1:00）' });

  for (const [field, value] of [
    ['start', start],
    ['end', end],
    ['break', brk]
  ] as const) {
    if (value !== null && value !== 0 && !isQuarter(value)) {
      issues.push({ severity: 'warn', field, message: '勤務時間は15分単位で入力してください' });
    }
  }

  if (start !== null && end !== null && start >= end) {
    issues.push({ severity: 'error', field: 'end', message: '開始より後の終了時刻を入力してください' });
  }

  const worked = workedMinutes(entry);
  if (worked !== null && worked < 0) {
    issues.push({ severity: 'error', field: 'break', message: '休憩が長すぎます（実働時間が負になります）' });
  }

  const isWorking = WORKING_TYPES.includes(entry.type);
  if (isWorking && (!entry.start || !entry.end)) {
    issues.push({ severity: 'warn', message: `${entry.type} は開始・終了を入力してください` });
  }
  if (!isWorking && (entry.start || entry.end || entry.break)) {
    issues.push({ severity: 'warn', message: `${entry.type} は開始・終了・休憩を空にすることを推奨します` });
  }

  if (entry.type === '休日勤務' && !restDay) {
    issues.push({ severity: 'warn', message: '平日に休日勤務が選択されています' });
  }
  if (entry.type === '通常勤務' && restDay) {
    issues.push({ severity: 'warn', message: '土日祝に通常勤務が選択されています' });
  }

  return issues;
}

export function hasError(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
