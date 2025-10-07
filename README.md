# Virtual Fit

> 「クローゼットの前で悩む時間を、AIが冒険に変える。」

Virtual Fit は、あなたの写真と気になる服を組み合わせて “いま着たらこうなる” を一瞬で描き出す、バーチャル試着アドベンチャーです。Google ログインでゲートをくぐれば、Gemini 2.5 Flash Image があなただけの試着ルームを展開。サイズ入力までこだわれば、肩幅や着丈のフィット感を★評価とコメントでジャッジしてくれます。

## ワクワクするポイント
- **映画のようなワンシーンを即生成**: 全身写真と服の画像をアップロードするだけで、AI があなただけの試着イメージを描写。
- **フィット感は任意で測定**: 体型＆服の寸法を入力すると、肩幅 / 着丈のマッチ度を★とコメントでフィードバック。入力しなくても画像生成は可能。
- **レトロフューチャーな UI**: 90 年代の個人サイトを彷彿とさせる Vaporwave テーマで、体験そのものがちょっとしたゲーム。
- **ロード演出もこだわり派**: 「試着する」を押すと `[ now fitting... ]` のゲージが走り、結果が届くまでの数秒も高揚感をキープ。
- **履歴は端末に保存**: 最後に生成した画像と入力値を IndexedDB に保存。ページを開き直してもすぐ再戦可能。

## 遊び方
1. **ログイン**: `/login` で Google アカウントを認証。
2. **試着モード突入** (`/tryon`):
   - 自分の全身写真＆服の写真をアップロード（長辺 1024px に自動リサイズ）。
   - スペック折りたたみを開けば、身長・肩幅・服の肩幅・着丈を入力可能（任意）。
   - 「試着する」を押すとロードゲージが走り、AI が試着イメージを生成。
3. **結果画面** (`/result`):
   - 生成画像を確認し、ローカルへ保存。
   - スペックを入れていれば★評価とコメント、サイズ比較テーブルをチェック。
   - ワンクリックで再試行もラクラク。

## 収録テクノロジー
- Next.js (Pages Router) / TypeScript / Turbopack
- Supabase Auth (Google OAuth)
- Gemini 2.5 Flash Image（試着イメージ生成）
- localforage (IndexedDB 保存)
- GitHub Actions + Vercel 自動デプロイ

## セットアップ
```bash
npm install
```
`.env.local` (例)
```ini
GOOGLE_API_KEY=your_google_generative_ai_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```
Supabase の Google プロバイダーを有効化し、`http://localhost:3000/` をリダイレクトに追加してください。

開発サーバーは `npm run dev` で起動。`http://localhost:3000` からどうぞ。

## デプロイメモ
- `.github/workflows/deploy.yml` が `main` への push で Vercel に自動デプロイ。
- GitHub Secrets と Vercel の環境変数に以下を設定。
  - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
  - `GOOGLE_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

ファッションの未来は、試着室ではなくブラウザから。さあ、あなたの次の一着を AI に預けてみましょう。
