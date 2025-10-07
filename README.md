# Virtual Fit

Google アカウントでログインし、全身写真と服の画像・採寸情報を入力すると Gemini 2.5 Flash Image による試着プレビューを生成する PoC です。生成結果に対しては肩幅と着丈のフィット感からスコアを算出し、★評価とコメントをフィードバックします。

## セットアップ

1. 依存関係をインストールします。

   ```bash
   npm install
   ```

2. 必要な環境変数を `.env.local` などに設定します。

   ```ini
   GOOGLE_API_KEY=your_google_generative_ai_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   - `GOOGLE_API_KEY`: Gemini 2.5 Flash Image 用 API キー（サーバ側のみで利用します）。
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase プロジェクトの URL と anon キー。Google OAuth を Supabase Auth で有効化してください。

3. Supabase Auth で Google プロバイダーを有効化したうえで、Redirect URL に `http://localhost:3000/` を許可してください。

## 開発サーバーの起動

```bash
npm run dev
```

`http://localhost:3000` にアクセスすると `/login` へリダイレクトされます。

## 主要フロー

- **/login**: Google でログインすると Supabase Auth のセッションが確立され、/tryon へ遷移します。
- **/tryon**:
  - 全身写真と服画像をアップロード（送信前に長辺 1024px にリサイズ）。
  - 体型（身長 / 肩幅）と服スペック（肩幅 / 着丈）を入力。
  - `localforage`（IndexedDB）に自画像と体型・直近の生成結果を保存し、リロード後も復元します。
  - 生成ボタンは 1 回押下で 1 枚のみ生成。直後は 12 秒間のクールダウンがかかり、429 を返します。
- **/result**:
  - 生成された試着プレビュー画像を表示し、5 段階評価（★）とコメント、スコア内訳を表示。
  - 体型と服スペックの比較テーブルで差分を確認できます。
  - 画像はサーバに保存せず、端末側でダウンロードできます。

## API プロキシ

`POST /api/tryon`

```json
{
  "userImageB64": "data:image/png;base64,...",
  "clothImageB64": "data:image/png;base64,...",
  "body": {
    "height": 175,
    "shoulder": 45
  },
  "cloth": {
    "shoulder": 48,
    "length": 70
  }
}
```

- Supabase Auth のアクセストークンを `Authorization: Bearer <token>` で付与してください。
- 成功時は `{ "imageBase64": "data:image/png;base64,..." }` を返します。
- バリデーションエラー時は 400、クールダウン中は 429、Gemini 失敗時は 500 を返します。

## フィット感スコア

肩幅と着丈で 0–100 点を算出し、それぞれ 50 点満点の合算スコアを ★1–★5 に割り当てます。
コメントは以下のようなルールで生成されます。

- 肩幅差が -1cm 未満 → 「肩幅が小さくタイト傾向」
- 肩幅差が +4cm 超 → 「肩が落ちる可能性」
- 理想着丈（身長 × 0.25）の ±10% 超 → 「着丈が長め/短め」

## 動作キャプチャ

PR 作成時は `docs/` 配下に録画（GIF もしくは動画）を追加し、この README にリンクを追記してください。例：`docs/tryon-demo.gif`。

## 注意事項

- Google API には無料枠配慮のためのクールダウンが入っています。短時間での連打は避けてください。
- 生成画像はサーバには保存していません。必要に応じて `/result` ページからダウンロードしてください。
- Supabase の service_role キーは使用せず、Anon キーで構成しています。
