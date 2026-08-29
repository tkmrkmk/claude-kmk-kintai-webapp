# Cloudflare Workers へのデプロイ

GitHub Pages に加えて Cloudflare Workers（Static Assets）へ配信するための手順と構成をまとめる。
現時点では静的アセットを配るだけで、GitHub Pages と機能上の差はない。
将来サーバー側の処理を足すときに、同一オリジンのまま拡張できるようにするための移行である。

## なぜ Cloudflare Workers か

| | 無料枠の商用利用 | サーバーロジック | 備考 |
|---|---|---|---|
| **Cloudflare Workers** | ○ | Workers（同一オリジン） | D1/KV/R2 が同じ無料枠 |
| GitHub Pages（現状） | ○ | ✗（完全静的） | 拡張の余地がない |
| Vercel | ✗（Hobby は商用不可） | Functions | 規約が壁 |
| Netlify | ✗（Starter は商用不可） | Functions | 同上 |
| Deno Deploy | ○ | Deno（同一オリジン） | 周辺サービスが少ない |

- 業務で使うアプリのため、無料枠で商用利用が禁止されているサービス（Vercel Hobby / Netlify Starter）は選定外。
- 静的アセットへのリクエストは無料・無制限。Worker 実行は 10万リクエスト/日まで無料。
- 拡張時に必要になる D1（SQLite）・KV・R2・Durable Objects・Cron Triggers が同じ無料枠に揃っている。

## 構成

アプリ側のコード変更は不要。`vite.config.ts` の `base: './'` による相対パス前提はルート配信でもそのまま動き、
`sw.js` を含む `dist/` 配下は丸ごとアセットとして配信される。

| ファイル | 役割 |
|---|---|
| `wrangler.jsonc` | Worker の設定。`dist/` をアセットディレクトリとして指定 |
| `.github/workflows/cloudflare.yml` | `main` への push でビルド → deploy |
| `package.json` | `wrangler`（devDependency）、`preview:cf` / `deploy` スクリプト |

`wrangler.jsonc` の `not_found_handling` は `single-page-application`。
本アプリは `App.svelte` のタブ切替のみでルーターを持たないが、未知パスへの直接アクセスで
404 の白画面にならないよう `index.html` を返す設定にしてある。

## 移行作業

### 1. Cloudflare アカウントの準備

1. Cloudflare にサインアップ（無料プランでよい）
2. ダッシュボードの Workers & Pages ページで **Account ID** を控える

### 2. API トークンの発行

1. My Profile → API Tokens → Create Token
2. テンプレート **"Edit Cloudflare Workers"** を使用
3. Account Resources / Zone Resources を対象アカウントに絞る
4. 生成されたトークンを控える（再表示できない）

### 3. GitHub Secrets の登録

リポジトリの Settings → Secrets and variables → Actions に登録する。

| Secret 名 | 値 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 手順2で発行したトークン |
| `CLOUDFLARE_ACCOUNT_ID` | 手順1で控えた Account ID |

### 4. デプロイ

`main` への push で `.github/workflows/cloudflare.yml` が自動実行される。
手動でデプロイする場合は以下。

```bash
npx wrangler login       # 初回のみ
npm run deploy           # npm run build && wrangler deploy
```

デプロイ先の URL は `https://kmk-kintai-webapp.<サブドメイン>.workers.dev`。
Worker 名は `wrangler.jsonc` の `name` に対応する。

### 5. 動作確認

- アプリが起動し、タブ切替・日次入力・TSV出力が動くこと
- LocalStorage は**オリジン単位**のため、GitHub Pages で入力したデータは引き継がれない。
  移行時は設定画面の JSON バックアップでエクスポート → 新URLでインポートする。
- Service Worker が登録され、オフラインで起動できること
- 未知パス（例 `/foo`）にアクセスしても白画面にならないこと

### 6. GitHub Pages の停止（任意）

Cloudflare 側の動作を確認したあと、`.github/workflows/pages.yml` を削除する。
リポジトリ設定の Pages も無効にする。確認が済むまでは両方を並行運用してよい。

## ローカルでの確認

```bash
npm run preview      # Vite の preview（通常はこちらで十分）
npm run preview:cf   # Workers ランタイム（workerd）で確認
```

`preview:cf` は初回に `workerd` のインストールスクリプト実行が必要な場合がある
（`npm approve-scripts workerd`）。

設定ファイルの検証だけなら以下でよい。

```bash
npm run build && npx wrangler deploy --dry-run
```

## 将来の拡張

### サーバーロジックを足す

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

```ts
// worker/index.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};
```

同一オリジンで `/api/*` を扱えるため、CORS の設定は不要。

### データの永続化・同期

複数端末での同期を実装する場合、`wrangler.jsonc` にバインディングを追加する。

- **D1** — SQLite。年度・日次エントリの構造化データ向け。無料枠 5GB
- **KV** — キーバリュー。設定値やバックアップJSONの保管向け
- **R2** — オブジェクトストレージ。Excel ファイル等を扱う場合
- **Cron Triggers** — 定期処理（月末リマインド等）

いずれを採用する場合も、`doc/architecture.md` の「バックエンド通信を行わない」という
前提を変更することになるため、要件から見直すこと。
