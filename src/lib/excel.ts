import { diffDays, fiscalStart, fromKey } from './date';

/** `年間入力シート` のデータ開始行（13行目 = 年度初日 4/1） */
export const FIRST_DATA_ROW = 13;

/** 日付キーに対応する `年間入力シート` の行番号 */
export function rowOf(key: string, fiscalYear: number): number {
  return FIRST_DATA_ROW + diffDays(fromKey(key), fiscalStart(fiscalYear));
}

export interface PasteBlock {
  id: 'work-time' | 'work-content' | 'note';
  /** 画面表示名 */
  label: string;
  /** 貼り付け先の列 */
  column: 'C' | 'H' | 'K';
  /** 説明（結合セル等の注意） */
  hint: string;
}

/**
 * 貼り付けブロック定義。
 * G列（数式）と H:J / K:L（セル結合）を壊さないよう3ブロックに分割する。
 */
export const PASTE_BLOCKS: PasteBlock[] = [
  {
    id: 'work-time',
    label: '① 勤務時間',
    column: 'C',
    hint: '勤怠区分 / 開始 / 終了 / 休憩（C〜F列）'
  },
  {
    id: 'work-content',
    label: '② 作業内容',
    column: 'H',
    hint: '作業内容(作業場所)。H:J は結合セル'
  },
  {
    id: 'note',
    label: '③ 備考',
    column: 'K',
    hint: '備考。K:L は結合セル'
  }
];

/** 貼り付け先セル番地（例: `C43`） */
export function targetCell(block: PasteBlock, startRow: number): string {
  return `${block.column}${startRow}`;
}
