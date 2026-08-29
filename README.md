# 勤怠入力省力化Webアプリ

スマホから日次の勤怠を記録し、月末に Excel `年間入力シート` へ貼り付けるTSVを出力するフロントエンド専用アプリ。

- 要件: `doc/requirements.md`
- Excel仕様: `doc/excel-format.md`
- アーキテクチャ: `doc/architecture.md`
- Cloudflare Workers へのデプロイ手順: `doc/deploy-cloudflare.md`

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
npm run preview:cf  # Workers ランタイム（workerd）でビルド結果を確認
npm run deploy   # ビルド + Cloudflare Workers へデプロイ
```

`npm run build` の出力は `dist/` の静的ファイルのみ。`vite.config.ts` の `base: './'` により、
GitHub Pages のようなサブディレクトリ配信でもそのまま動作する。
`main` への push で以下の2つの workflow が走る。どちらか一方だけを使う場合は不要な workflow を削除すること。

- `.github/workflows/cloudflare.yml` — Cloudflare Workers（後述）
- `.github/workflows/pages.yml` — GitHub Pages（リポジトリ設定で Pages のソースを "GitHub Actions" にすること）

## Cloudflare Workers へのデプロイ

`wrangler.jsonc` で `dist/` を静的アセットとして配信する。バックエンドは持たないが、
将来サーバー側の処理を足す場合も同一オリジンのまま拡張できる構成にしてある。
移行手順・選定理由・拡張時の構成は `doc/deploy-cloudflare.md` を参照。

初回のみ、以下の準備が必要。

1. `npx wrangler login`（ローカルからデプロイする場合）
2. GitHub Actions からデプロイする場合はリポジトリの Secrets に以下を登録する
   - `CLOUDFLARE_API_TOKEN` — テンプレート "Edit Cloudflare Workers" で作成
   - `CLOUDFLARE_ACCOUNT_ID` — ダッシュボードの Workers & Pages ページに表示される ID

`base: './'` の相対パス前提はルート配信でもそのまま動くため、アプリ側のコード変更は不要。
`sw.js` を含む `dist/` 配下は丸ごとアセットとして配信される。

### サーバーロジックを足すとき

`wrangler.jsonc` に `main`（Worker のエントリ）と `assets.binding` を追加する。
バインディングを付けると、アセットに該当しないリクエストだけが Worker のコードに渡る。

```jsonc
{
  "main": "./worker/index.ts",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  }
}
```

D1（SQLite）・KV・R2・Cron Triggers も同じ `wrangler.jsonc` にバインディングとして追加できる。

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
