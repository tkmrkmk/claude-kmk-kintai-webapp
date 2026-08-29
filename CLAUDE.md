# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

スマホから日次の勤怠を記録し、月末に Excel `年間入力シート` へ貼り付ける TSV を出力する
フロントエンド専用 SPA。バックエンド・DB を持たず、永続化は LocalStorage のみ。

- 要件: `doc/requirements.md`
- 連携先 Excel の仕様（列構成・行番号算出・数式・祝日マスタ・TSV書式）: `doc/excel-format.md`
- アーキテクチャと技術選定の理由: `doc/architecture.md`
- Cloudflare Workers へのデプロイ手順: `doc/deploy-cloudflare.md`

## コマンド

```bash
npm install
npm run dev       # 開発サーバ
npm run check     # svelte-check（型チェック）
npm run build     # 型チェック + 本番ビルド（dist/）
npm run build:only  # 型チェックなしのビルドのみ
npm run preview   # ビルド結果の確認
npm run preview:cf  # Workers ランタイム（workerd）でビルド結果を確認
npm run deploy    # ビルド + Cloudflare Workers へデプロイ（要 wrangler login）
```

自動テストは設定されていない。動作確認は `npm run check`（型）と `npm run dev` での手動確認が基本。
`main` への push で2つの workflow が `npm run build` を実行してデプロイする。
`.github/workflows/cloudflare.yml`（Cloudflare Workers / `wrangler.jsonc`）と
`.github/workflows/pages.yml`（GitHub Pages）の並行運用。デプロイ先の詳細は README を参照。

## アーキテクチャ

### 技術選定の制約（変更時は要注意）

- **日付処理は標準 `Date`/`Intl` のみ**。dayjs 等の日付ライブラリは意図的に不採用（`doc/architecture.md` 参照）。
- ランタイム依存は Svelte のみ。安易に依存を追加しない。
- 出力は `dist/` の静的ファイルのみ。`vite.config.ts` の `base: './'` によりサブディレクトリ配信でも動く。相対パス前提を崩さないこと。
- `vite.config.ts` 内の `serviceWorker()` プラグインがビルド後の `dist/` 全ファイルを列挙して `sw.js` を自動生成する（プリキャッシュのみ、workbox 等は使わない）。ビルド成果物の構成を変えるとこの自動生成に影響する。

### データフローとドメインロジック（`src/lib/`）

- `types.ts` — `DayType`（7区分の勤怠区分）、`DayEntry`（1日分）、`FiscalData` の型定義。**`DAY_TYPES` の文字列は Excel `年間入力シート` C列の入力規則と完全一致させる必要がある**（変更すると Excel 側の貼り付けが壊れる）。
- `store.svelte.ts` — Svelte 5 runes（`$state`）によるアプリ全体の状態。`setDay`/`deleteDay`/`applyDays` 等の更新のたびに `storage.ts` へ即時保存する（明示的な保存操作はない）。
- `storage.ts` — LocalStorage 入出力。キーは年度単位（`kintai:<年度>`）。
- `date.ts` — 年度（4/1始まり）・日付キー（`YYYY-MM-DD`）変換などのユーティリティ。
- `excel.ts` — 日付キー→`年間入力シート`の行番号変換（`FIRST_DATA_ROW = 13` を起点に日数差で算出）、および3分割の貼り付けブロック定義（`PASTE_BLOCKS`）。
- `tsv.ts` — TSV の生成・パース・マージ（インポート時の差分用）。
- `excel.ts`/`tsv.ts` の設計は Excel 側の制約に直接従っている。**G列（実働時間）は数式のため出力しない。H:J・K:L はセル結合されているため、①勤務時間（C〜F）②作業内容（H）③備考（K）の3ブロックに分けてコピーする**運用（`ExportView.svelte`）。ここを崩す変更は Excel 側の貼り付けを壊すので、`doc/excel-format.md` を必ず参照すること。
- `holidays.ts` — 祝日マスタ（Excel `Q4:R28` 相当）。年度が変わるとここと `doc/excel-format.md` 4.1 の両方の更新が必要。
- `summary.ts` — 月次集計。
- `validation.ts` — `doc/requirements.md` 7章のバリデーションルール（15分粒度、開始<終了、休日勤務/通常勤務と曜日の整合など）。
- `clipboard.ts` — Clipboard API とフォールバック（非対応環境向けにテキストエリア手動選択）。

### 画面構成（`src/`）

`App.svelte` がタブ切替（入力 / カレンダー / 出力 / 取込 / 設定）の唯一のルーティングで、SPA ルーターは使わない。各 `components/*.svelte` はビューごとの UI で、状態は `store.svelte.ts` を直接参照する（props 経由のグローバルステート受け渡しはしない）。

- `DayEditor.svelte` — 日次入力。区分ボタン・15分刻みピッカー・プリセット。
- `CalendarView.svelte` — 月カレンダー・一覧・月次集計。未入力日/土日祝の表示を担う。
- `ExportView.svelte` — TSV生成と3ブロック別コピーUI。貼り付け先セル番地（例 `C43`）を明示する。
- `ImportView.svelte` — TSV取り込みと差分プレビュー（上書き確認）。
- `SettingsView.svelte` — 年度・既定パターン・プリセット・JSONバックアップ。
- `TimeSelect.svelte` — 15分刻みの時刻選択。

## Excel 連携で変更時に必ず確認すること

`年間入力シート` へのTSV貼り付けが前提の設計のため、以下に触れる変更は `doc/excel-format.md` と整合させること。

- 勤怠区分の文字列（7値）
- 行番号算出（`FIRST_DATA_ROW` = 13行目 = 年度初日）
- 貼り付けブロックの列・分割（C〜F / H / K の3分割、G列・O列は出力しない）
- TSVの書式（タブ区切り、`\r\n`、`h:mm` 形式でゼロ埋めなし、未入力日も空行で出力し行ズレを防ぐ）
