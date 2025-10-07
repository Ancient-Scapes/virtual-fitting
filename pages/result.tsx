import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useSupabase } from "@/components/SupabaseProvider";
import { loadLastResult } from "@/lib/storage";
import type { StoredResult } from "@/lib/types";

function formatDate(iso: string) {
  const date = new Date(iso);
  return isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function renderStars(count: number) {
  return "★".repeat(count) + "☆".repeat(Math.max(0, 5 - count));
}

export default function ResultPage() {
  const router = useRouter();
  const { supabase, session, loading } = useSupabase();
  const [storedResult, setStoredResult] = useState<StoredResult | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const userEmail = session?.user?.email ?? undefined;

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await loadLastResult();
      if (!active) return;
      setStoredResult(result);
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const breakdown = storedResult?.feedback.breakdown;

  const comparisonRows = useMemo(() => {
    if (!storedResult) return [];
    const shoulderDiff = storedResult.feedback.breakdown.shoulderDiff;
    const lengthDiffRatio =
      (storedResult.cloth.length -
        storedResult.feedback.breakdown.lengthTarget) /
      storedResult.feedback.breakdown.lengthTarget;
    return [
      {
        label: "肩幅",
        body: `${storedResult.body.shoulder} cm`,
        cloth: `${storedResult.cloth.shoulder} cm`,
        note: `${shoulderDiff >= 0 ? "+" : ""}${shoulderDiff.toFixed(1)} cm`,
      },
      {
        label: "着丈",
        body: `${storedResult.body.height} cm × 0.25 = ${storedResult.feedback.breakdown.lengthTarget.toFixed(1)} cm`,
        cloth: `${storedResult.cloth.length} cm`,
        note: `${lengthDiffRatio >= 0 ? "+" : ""}${(lengthDiffRatio * 100).toFixed(1)} %`,
      },
    ];
  }, [storedResult]);

  if (loading || !hydrated) {
    return (
      <div className="page-centered">
        <p>結果を読み込み中...</p>
      </div>
    );
  }

  if (!storedResult) {
    return (
      <div className="page-centered">
        <div className="card">
          <p>生成結果が見つかりませんでした。</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => router.replace("/tryon")}
          >
            入力画面へ戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Virtual Fit | Result</title>
      </Head>
      <div className="page">
        <header className="page-header">
          <div>
            <h1>Virtual Fit</h1>
            <p className="tagline">その服、買う前に着ている自分をイメージしてみない？</p>
            {userEmail && <p className="user-email">{userEmail}</p>}
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => router.replace("/tryon")}
            >
              <span className="material-icons">replay</span>
              再試行する
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/login");
              }}
            >
              <span className="material-icons">logout</span>
              ログアウト
            </button>
          </div>
        </header>

        <section className="panel result">
          <h2 className="section-title">生成結果</h2>
          <div className="result-layout">
            <div className="result-image">
              <Image
                src={storedResult.imageBase64}
                alt="生成された試着プレビュー"
                width={768}
                height={960}
                unoptimized
                className="image-preview"
                style={{ width: "100%", height: "auto" }}
              />
              <a
                className="link"
                href={storedResult.imageBase64}
                download={`virtual-tryon-${Date.now()}.png`}
              >
                画像を保存する
              </a>
              <p className="generated-at">
                生成日時: {formatDate(storedResult.generatedAt)}
              </p>
            </div>
            <div className="result-summary">
              <p className="stars">{renderStars(storedResult.feedback.stars)}</p>
              <p className="comment">{storedResult.feedback.comment}</p>

              {breakdown && (
                <ul className="score-list">
                  <li>総合スコア: {breakdown.totalScore.toFixed(1)}</li>
                  <li>肩幅スコア: {breakdown.shoulderScore.toFixed(1)}</li>
                  <li>着丈スコア: {breakdown.lengthScore.toFixed(1)}</li>
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>体型 vs 服スペック</h2>
          <table className="comparison-table">
            <thead>
              <tr>
                <th>項目</th>
                <th>体型</th>
                <th>服</th>
                <th>差分</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.body}</td>
                  <td>{row.cloth}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
