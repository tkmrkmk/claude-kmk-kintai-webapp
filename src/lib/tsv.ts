import { daysInMonth, makeKey } from './date';
import { PASTE_BLOCKS, rowOf, targetCell, type PasteBlock } from './excel';
import { DAY_TYPES, emptyEntry, isEmptyEntry, type DayEntry, type DayType } from './types';

const EOL = '\r\n';

/** タブ・改行を除去する（TSVの行/列崩れを防ぐ） */
export function sanitize(value: string): string {
  return value.replace(/[\t\r\n]+/g, ' ').trim();
}

export interface ExportBlock {
  block: PasteBlock;
  /** 貼り付け先セル番地 */
  cell: string;
  tsv: string;
  /** 1行ずつ貼り付けるフォールバック用（結合セルに拒否された場合） */
  lines: string[];
}

export interface MonthExport {
  year: number;
  month: number;
  startRow: number;
  endRow: number;
  rowCount: number;
  blocks: ExportBlock[];
}

function blockRow(block: PasteBlock, entry: DayEntry | undefined): string {
  const e = entry;
  switch (block.id) {
    case 'work-time':
      return [e?.type ?? '', e?.start ?? '', e?.end ?? '', e?.break ?? ''].join('\t');
    case 'work-content':
      return sanitize(e?.work ?? '');
    case 'note':
      return sanitize(e?.note ?? '');
  }
}

/**
 * 対象月のTSVをブロックごとに生成する。
 * 未入力日も空行として出力し、行ズレを防ぐ。
 */
export function buildMonthExport(
  days: Record<string, DayEntry>,
  fiscalYear: number,
  year: number,
  month: number
): MonthExport {
  const count = daysInMonth(year, month);
  const keys = Array.from({ length: count }, (_, i) => makeKey(year, month, i + 1));
  const startRow = rowOf(keys[0], fiscalYear);

  const blocks = PASTE_BLOCKS.map<ExportBlock>((block) => {
    const lines = keys.map((key) => {
      const entry = days[key];
      return blockRow(block, isEmptyEntry(entry) && !entry?.type ? undefined : entry);
    });
    return {
      block,
      cell: targetCell(block, startRow),
      tsv: lines.join(EOL) + EOL,
      lines
    };
  });

  return { year, month, startRow, endRow: startRow + count - 1, rowCount: count, blocks };
}

export type ImportShape = 'full' | 'work-time' | 'work-content' | 'note';

export interface ImportRow {
  /** 対象月の何日目か（1始まり） */
  day: number;
  key: string;
  entry: DayEntry | null;
}

export interface ImportResult {
  shape: ImportShape;
  rows: ImportRow[];
  /** 対象月の日数と行数が食い違う等の警告 */
  warnings: string[];
}

function normalizeType(value: string): DayType | '' {
  const v = value.trim();
  return (DAY_TYPES as readonly string[]).includes(v) ? (v as DayType) : '';
}

/** `9:30` `09:30` `9:30:00` を `H:mm` に正規化 */
function normalizeTime(value: string): string {
  const m = /^(\d{1,3}):([0-5]\d)(?::[0-5]\d)?$/.exec(value.trim());
  return m ? `${Number(m[1])}:${m[2]}` : value.trim();
}

/**
 * Excelからコピーした範囲を取り込む。
 * 列数から形状を推定する（C〜L の全列 / ①勤務時間4列 / 1列ブロック）。
 */
export function parseImport(
  text: string,
  year: number,
  month: number,
  singleColumnAs: 'work-content' | 'note' = 'work-content'
): ImportResult {
  const warnings: string[] = [];
  const raw = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  const lines = raw.length ? raw.split('\n') : [];
  const width = lines.reduce((max, l) => Math.max(max, l.split('\t').length), 0);

  let shape: ImportShape;
  if (width >= 9) shape = 'full';
  else if (width >= 4) shape = 'work-time';
  else shape = singleColumnAs;

  const count = daysInMonth(year, month);
  if (lines.length !== count) {
    warnings.push(
      `貼り付けた行数（${lines.length}行）が${month}月の日数（${count}日）と一致しません。行ズレの可能性があります。`
    );
  }

  const rows: ImportRow[] = [];
  for (let i = 0; i < Math.min(lines.length, count); i++) {
    const cols = lines[i].split('\t');
    const day = i + 1;
    const key = makeKey(year, month, day);
    const entry = emptyEntry();

    if (shape === 'full' || shape === 'work-time') {
      entry.type = normalizeType(cols[0] ?? '') || entry.type;
      entry.start = normalizeTime(cols[1] ?? '');
      entry.end = normalizeTime(cols[2] ?? '');
      entry.break = normalizeTime(cols[3] ?? '');
      if (shape === 'full') {
        // C=0 D=1 E=2 F=3 G=4(数式) H=5 I=6 J=7 K=8
        entry.work = sanitize(cols[5] ?? '');
        entry.note = sanitize(cols[8] ?? '');
      }
      if (!normalizeType(cols[0] ?? '') && !entry.start && !entry.end && !entry.work && !entry.note) {
        rows.push({ day, key, entry: null });
        continue;
      }
    } else if (shape === 'work-content') {
      entry.work = sanitize(cols[0] ?? '');
      if (!entry.work) {
        rows.push({ day, key, entry: null });
        continue;
      }
    } else {
      entry.note = sanitize(cols[0] ?? '');
      if (!entry.note) {
        rows.push({ day, key, entry: null });
        continue;
      }
    }

    rows.push({ day, key, entry });
  }

  return { shape, rows, warnings };
}

/** 取り込み形状に応じて既存データへ差分マージした結果を返す（元データは変更しない） */
export function mergeEntry(
  existing: DayEntry | undefined,
  incoming: DayEntry,
  shape: ImportShape
): DayEntry {
  const base: DayEntry = existing ? { ...existing } : emptyEntry();
  if (shape === 'full' || shape === 'work-time') {
    base.type = incoming.type;
    base.start = incoming.start;
    base.end = incoming.end;
    base.break = incoming.break;
  }
  if (shape === 'full' || shape === 'work-content') base.work = incoming.work;
  if (shape === 'full' || shape === 'note') base.note = incoming.note;
  return base;
}
