# カスタム五十音表メーカー

それぞれの文字から始まる言葉で、自分だけの五十音表をつくれるWebサービス。

## 機能

- 50マスの五十音表に自分の言葉を埋める
- 入力内容はブラウザに自動保存（localStorage + Cookie）
- PNG画像として保存
- Xでワンクリック共有（**動的OGP画像つき**: シェアされたURLを開いた人は同じ表をカード形式で見られる）
- 共有URLからアクセスした人は、その表を**編集モードで開いて再投稿**できる

## 技術スタック

- Next.js 14 (App Router)
- TypeScript
- React 18
- @vercel/og (動的OGP画像生成 / Edge Runtime)
- html2canvas (ブラウザ側のPNG出力)

## ローカル開発

```bash
npm install
npm run dev
```

http://localhost:3000 で開きます。

## Vercelへのデプロイ

### 初回デプロイ

1. このリポジトリをGitHubにpush
2. [vercel.com](https://vercel.com) でサインアップ → 「Add New Project」
3. GitHubリポジトリを連携 → Import
4. 設定はデフォルトのままで「Deploy」
5. 数分でデプロイ完了

### 環境変数（任意）

OGP画像のフルパス生成のため、デプロイ後に環境変数 `NEXT_PUBLIC_BASE_URL` を本番URLに設定すると、SNSプレビューがより確実に動作します（例: `https://your-app.vercel.app`）。

Vercelのプロジェクト設定 → Environment Variables から追加可能。

### 独自ドメインを使う場合

Vercelのダッシュボードから「Domains」設定で独自ドメインを追加できます（無料）。
ドメイン取得サービス（お名前.com、ムームードメイン、Cloudflare Registrarなど）で取ったドメインのDNSをVercelに向けるだけ。

## ファイル構成

```
.
├── app/
│   ├── layout.tsx          # 共通レイアウト
│   ├── page.tsx            # メインページ（SSR: OGPメタタグ生成）
│   ├── Editor.tsx          # エディタ本体（クライアントコンポーネント）
│   ├── globals.css         # 全スタイル
│   └── api/
│       └── og/
│           └── route.tsx   # 動的OGP画像生成 (Edge Runtime)
└── lib/
    ├── kana.ts             # 五十音表の構造定義
    └── encode.ts           # 表データのURLエンコード/デコード
```

## 動作の仕組み: SNS共有

1. ユーザーが「Xのポストで共有」を押す
2. 表の内容を Base64URL エンコードして URLパラメータ `?d=...` に変換
3. ツイート文と共有URLを `twitter.com/intent/tweet` に渡して投稿画面を開く
4. ユーザーが投稿
5. Xのクローラーが共有URLにアクセス → `app/page.tsx` の `generateMetadata` がOGP画像のURL `/api/og?d=...` を返す
6. クローラーがそのOGP画像にアクセス → `app/api/og/route.tsx` が表データから動的にPNGを生成して返す
7. ツイートに画像つきカードが表示される

## ライセンス

任意でどうぞ。
