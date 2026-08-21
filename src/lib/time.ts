/** `H:mm` 文字列と分の相互変換。時刻ライブラリは使わない。 */

/** `9:30` / `09:30` / `-8:00` を分に変換する。不正なら null。 */
export function parseTime(value: string): number | null {
  const s = value.trim();
  if (!s) return null;
  const m = /^(-)?(\d{1,3}):([0-5]\d)$/.exec(s);
  if (!m) return null;
  const sign = m[1] ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/** 分を `9:30` 形式（ゼロ埋めなし）にする。Excelが時刻値として解釈できる書式。 */
export function formatTime(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

/** 15分単位か */
export function isQuarter(minutes: number): boolean {
  return minutes % 15 === 0;
}

/** 実働時間（分）。終了 − 開始 − 休憩。算出できなければ null。 */
export function workedMinutes(entry: {
  start: string;
  end: string;
  break: string;
}): number | null {
  const start = parseTime(entry.start);
  const end = parseTime(entry.end);
  if (start === null || end === null) return null;
  const brk = parseTime(entry.break) ?? 0;
  return end - start - brk;
}

/** 15分刻みの時刻候補（`H:mm`）を生成する */
export function quarterOptions(fromMinutes = 0, toMinutes = 24 * 60): string[] {
  const out: string[] = [];
  for (let m = fromMinutes; m <= toMinutes; m += 15) out.push(formatTime(m));
  return out;
}

/** 分を `8時間30分` のような表示にする */
export function humanDuration(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}分`;
  return m === 0 ? `${sign}${h}時間` : `${sign}${h}時間${m}分`;
}
