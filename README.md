# Web test — 薬学部 試験問題データベース

大学の試験問題を仲間内（5〜20人）で共有・検索するための Web アプリ。
問題を **蓄積する / 検索する / 回答を見る** ことに用途を絞っています。

## 技術スタック

- Next.js 15（App Router）+ TypeScript
- Supabase（Database / Auth / Storage）
- Google Gemini API（Flash 系。画像からのテキスト抽出・重複判定）
- Vercel デプロイ想定

## アーキテクチャ

```
app/                     画面（Server Component 基本、必要箇所のみ Client）
  api/extract            画像からのテキスト抽出（Gemini Vision、予算管理つき）
  api/ai/duplicate       登録前の重複判定（全文検索→Gemini）
  auth/callback          Google OAuth コールバック
components/              再利用可能な UI / 機能コンポーネント
lib/
  supabase/              クライアント生成・認証
  repositories/          DB アクセス層（純粋なクエリ）
  services/              業務ロジック層（認証・正規化・整合性）
  actions/               Server Actions（CRUD）
  ai/                    AiProvider インターフェース + Gemini 実装 + 予算管理
  text/                  normalized_text 生成
types/                   DB 型定義
supabase/schema.sql      テーブル / RLS / 検索 / 予算管理の定義
```

AI は **インターフェース経由**（`lib/ai/types.ts`）で実装しており、プロバイダーを差し替えられます。
画像抽出のフロー: Storage へ保存 → URL 取得 → サーバーの `/api/extract` が Gemini に画像を渡し、
JSON Schema で構造化抽出（グラフ/図は本文化せず `has_graph=true`）。APIキーはサーバーのみが保持。

## セットアップ

### 1. 依存関係

```bash
npm install
```

### 2. Supabase プロジェクト

1. [Supabase](https://supabase.com) でプロジェクトを作成。
2. SQL Editor で `supabase/schema.sql` を実行（テーブル・RLS・検索関数・Storage バケットを作成）。
3. Authentication → Providers → **Google** を有効化し、Google Cloud の OAuth クライアント
   （承認済みリダイレクト URI に `https://<project>.supabase.co/auth/v1/callback`）を設定。
4. 登録後、最初の管理者を設定：
   ```sql
   update public.profiles set is_admin = true where email = 'you@example.com';
   ```
   （削除操作は管理者のみ可能）

### 3. 環境変数

`.env.local.example` を `.env.local` にコピーして値を設定：

```bash
cp .env.local.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase の API 設定から
- `SUPABASE_SERVICE_ROLE_KEY` — 同上（サーバー専用）
- `NEXT_PUBLIC_APP_URL` — 開発は `http://localhost:3000`
- `GEMINI_API_KEY` — Google AI Studio（https://aistudio.google.com/apikey）で発行
- `GEMINI_MODEL` — 任意。既定は `gemini-2.5-flash`（最新の Flash 名は公式で確認）

### 4. 起動

```bash
npm run dev
```

## 主な仕様メモ

- **認証**：Google ログインのみ。未ログインは利用不可（middleware で制御）。
- **招待制**：OAuth は「公開」にしてテストユーザー登録を不要にし、代わりにアプリ側で
  **招待コード（合言葉）**を要求する。初回ログイン後 `/join` で合言葉を入力した人だけ有効化
  （`profiles.is_approved`）。照合はサーバー(env `APP_INVITE_CODE`)で行い、有効化は
  service_role 経由でのみ実施するため、ユーザーが自分で有効化することはできない。管理者は
  常に有効。
- **権限**：全員が閲覧・登録・編集可。**削除は管理者のみ**（RLS で強制）。
- **テキスト抽出**：スマホ写真を Gemini Vision で構造化抽出。グラフ/図は本文化せず
  `has_graph` フラグで示し、元画像をそのまま紐づける。抽出結果は必ず手動修正できる。
- **検索**：PostgreSQL の `pg_trgm`（GIN インデックス）による高速な部分一致検索。
  日本語は標準の `to_tsvector` で語分割できないため trigram を採用。
- **重複防止**：同一ブック内で正規化テキストが完全一致する問題は登録不可（UNIQUE 制約）。
- **AI 重複判定**：登録時のみ実行。類似度 90% 以上で警告するが、登録は可能。
- **AI 予算**：月あたりの回数上限（既定 500回/月、`claim_ai_budget` の `v_monthly_limit`）。
  Gemini 無料枠は課金されず回数制限のみなので、金額ではなく回数で安全網を張る。超過時は
  AI を使わず（手入力）登録を継続。
- **画像**：Supabase Storage の `question-images`（公開）に保存し、DB には URL のみ保存。

## 仕様からの差分（明示）

- DB の `questions` に **`choices`（選択肢）列を追加**。仕様10で OCR が「選択肢」を分割する
  と定義されているが、仕様16の DB 定義には列が無かったため、データを失わないよう追加した。
