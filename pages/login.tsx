import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useSupabase } from "@/components/SupabaseProvider";

export default function LoginPage() {
  const router = useRouter();
  const { supabase, session, loading } = useSupabase();
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      router.replace("/tryon");
    }
  }, [loading, session, router]);

  const handleGoogleLogin = async () => {
    setError(null);
    setSigningIn(true);
    const origin = window.location.origin;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        skipBrowserRedirect: false,
        redirectTo: `${origin}/tryon`,
      },
    });

    if (authError) {
      setError(authError.message);
      setSigningIn(false);
    }
  };

  return (
    <>
      <Head>
        <title>Virtual Fit | Login</title>
      </Head>
      <div className="page-centered">
        <div className="card">
          <h1 className="title">Virtual Fit</h1>
          <p className="tagline">その服、買う前に着ている自分をイメージしてみない？</p>
          <p className="subtitle">Google アカウントでログインしてください</p>
          <button
            type="button"
            className="primary-button"
            onClick={handleGoogleLogin}
            disabled={signingIn || loading}
          >
            <span className="material-icons">
              {signingIn ? "hourglass_top" : "login"}
            </span>
            {signingIn ? "リダイレクト中..." : "Google でログイン"}
          </button>
          {error && <p className="error-text">{error}</p>}
        </div>
      </div>
    </>
  );
}
