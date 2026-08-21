# 勤怠入力省力化Webアプリ

スマホから日次の勤怠を記録し、月末に Excel `年間入力シート` へ貼り付けるTSVを出力するフロントエンド専用アプリ。

- 要件: `doc/requirements.md`
- Excel仕様: `doc/excel-format.md`
- アーキテクチャ: `doc/architecture.md`

## 構成

Svelte 5 (runes) + Vite + TypeScript の SPA。バックエンド・DBなし、永続化は LocalStorage のみ。
Service Worker でアセットをプリキャッシュし、オフラインでも起動できる。ランタイム依存ライブラリは Svelte のみ（日付ライブラリは使わない）。

## コマンド

```bash
npm install
npm run dev      # 開発サーバ
npm run check    # svelte-check（型チェック）
npm run build    # 型チェック + 本番ビルド（dist/）
npm run preview  # ビルド結果の確認
```

`npm run build` の出力は `dist/` の静的ファイルのみ。`vite.config.ts` の `base: './'` により、
GitHub Pages のようなサブディレクトリ配信でもそのまま動作する。
`main` への push で `.github/workflows/pages.yml` が Pages へデプロイする（リポジトリ設定で Pages のソースを "GitHub Actions" にすること）。

## ソース構成

```
src/
  App.svelte              画面切替（入力 / カレンダー / 出力 / 取込 / 設定）
  components/
    DayEditor.svelte      日次入力（区分ボタン・15分刻みピッカー・プリセット）
    CalendarView.svelte   月カレンダー・一覧・月次集計
    ExportView.svelte     TSV生成とブロック別コピー
    ImportView.svelte     TSV取り込みと差分プレビュー
    SettingsView.svelte   年度・既定パターン・プリセット・バックアップ
    TimeSelect.svelte     15分刻みの時刻選択
  lib/
    types.ts              勤怠区分・DayEntry・設定の型
    date.ts               年度/日付ユーティリティ（標準 Date のみ）
    time.ts               `H:mm` ⇄ 分の変換、実働時間
    holidays.ts           祝日マスタ（Excel Q4:R28 相当）
    excel.ts              行番号の算出と貼り付けブロック定義
    tsv.ts                TSVの生成・パース・マージ
    validation.ts         入力検証（要件定義 7章）
    summary.ts            月次集計
    storage.ts            LocalStorage 入出力（キー: `kintai:<年度>`）
    store.svelte.ts       アプリ状態（runes）と即時保存
    clipboard.ts          クリップボードコピーとフォールバック
```

## 月末の運用

1. 「出力」タブで対象月を選ぶ。未入力・警告がある場合は先に解消する。
2. ①勤務時間 → `C{行}`、②作業内容 → `H{行}`、③備考 → `K{行}` の順にコピーして貼り付ける。
   G列（数式）と H:J / K:L（結合セル）を壊さないため、3ブロックに分割している。
3. 結合セルへの複数行貼り付けが拒否される場合は、②③の「1行ずつ」モードを使う。
4. Excel の「勤務報告書作成」ボタンで月度シートを生成する。

## データの保存先

`localStorage` の `kintai:<年度>`（例: `kintai:2026`）。ブラウザのサイトデータを削除すると消えるため、
設定タブの JSON バックアップを併用すること。外部への送信は一切行わない。
