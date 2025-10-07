import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import {
  ChangeEvent,
  ChangeEventHandler,
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSupabase } from "@/components/SupabaseProvider";
import { resizeImageToDataUrl } from "@/lib/image";
import { evaluateFit } from "@/lib/rating";
import { bodySpecSchema, clothSpecSchema } from "@/lib/schemas";
import {
  loadBodySpec,
  loadLastResult,
  loadUserImage,
  saveBodySpec,
  saveLastResult,
  saveUserImage,
} from "@/lib/storage";
import type { BodySpec, ClothSpec, StoredResult } from "@/lib/types";

const COOLDOWN_SECONDS = 12;

type BodyFormState = {
  height: string;
  shoulder: string;
};

type ClothFormState = {
  shoulder: string;
  length: string;
};

const emptyBody: BodyFormState = {
  height: "",
  shoulder: "",
};

const emptyCloth: ClothFormState = {
  shoulder: "",
  length: "",
};

type ImageState = {
  base64: string;
  preview: string;
  width: number;
  height: number;
};

function normalizeNumericInput(value: string) {
  const toHalfWidth = value.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
  );
  return toHalfWidth.replace(/[^0-9]/g, "");
}

function parseBody(form: BodyFormState): BodySpec {
  return {
    height: Number(form.height),
    shoulder: Number(form.shoulder),
  };
}

function parseCloth(form: ClothFormState): ClothSpec {
  return {
    shoulder: Number(form.shoulder),
    length: Number(form.length),
  };
}

export default function TryOnPage() {
  const router = useRouter();
  const { supabase, session, loading: sessionLoading } = useSupabase();

  const [bodyForm, setBodyForm] = useState<BodyFormState>(emptyBody);
  const [clothForm, setClothForm] = useState<ClothFormState>(emptyCloth);
  const [userImage, setUserImage] = useState<ImageState | null>(null);
  const [clothImage, setClothImage] = useState<ImageState | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const cooldownUntilRef = useRef<number>(0);
  const [hydrated, setHydrated] = useState(false);
  const [hasStoredResult, setHasStoredResult] = useState(false);

  const isAuthenticated = useMemo(() => !!session, [session]);
  const userEmail = session?.user?.email ?? undefined;

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.replace("/login");
    }
  }, [sessionLoading, session, router]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [storedBody, storedImage, storedResult] = await Promise.all([
        loadBodySpec(),
        loadUserImage(),
        loadLastResult(),
      ]);

      if (!active) return;

      if (storedBody) {
        setBodyForm({
          height: String(storedBody.height ?? ""),
          shoulder: String(storedBody.shoulder ?? ""),
        });
      }

      if (storedImage) {
        setUserImage({
          base64: storedImage,
          preview: storedImage,
          width: 0,
          height: 0,
        });
      }

      setHasStoredResult(Boolean(storedResult));

      setHydrated(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const timer = window.setInterval(() => {
      const remainingMs = cooldownUntilRef.current - Date.now();
      if (remainingMs <= 0) {
        setCooldownRemaining(0);
        window.clearInterval(timer);
      } else {
        setCooldownRemaining(Math.ceil(remainingMs / 1000));
      }
    }, 500);

    return () => {
      window.clearInterval(timer);
    };
  }, [cooldownRemaining]);

  useEffect(() => {
    if (!hydrated) return;
    const parsed = parseBody(bodyForm);
    if (Object.values(parsed).every((value) => Number.isFinite(value) && value > 0)) {
      void saveBodySpec(parsed);
    }
  }, [bodyForm, hydrated]);

  const handleImageChange = async (
    event: ChangeEvent<HTMLInputElement>,
    setter: Dispatch<SetStateAction<ImageState | null>>,
    saveFn?: (dataUrl: string | null) => Promise<void>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const { dataUrl, width, height } = await resizeImageToDataUrl(file);
      const previewUrl = URL.createObjectURL(file);
      setter((prev) => {
        if (prev?.preview?.startsWith("blob:")) {
          URL.revokeObjectURL(prev.preview);
        }
        return {
          base64: dataUrl,
          preview: previewUrl,
          width,
          height,
        };
      });
      if (saveFn) {
        await saveFn(dataUrl);
      }
    } catch (err) {
      console.error(err);
      setApiError("画像の読み込みに失敗しました");
    }
  };

  const handleBodyInput = (
    key: keyof BodyFormState
  ): ChangeEventHandler<HTMLInputElement> => {
    return (event) => {
      const normalized = normalizeNumericInput(event.target.value);
      setBodyForm((prev) => ({ ...prev, [key]: normalized }));
    };
  };

  const handleClothInput = (
    key: keyof ClothFormState
  ): ChangeEventHandler<HTMLInputElement> => {
    return (event) => {
      const normalized = normalizeNumericInput(event.target.value);
      setClothForm((prev) => ({ ...prev, [key]: normalized }));
    };
  };

  useEffect(() => {
    return () => {
      if (userImage?.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(userImage.preview);
      }
    };
  }, [userImage?.preview]);

  useEffect(() => {
    return () => {
      if (clothImage?.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(clothImage.preview);
      }
    };
  }, [clothImage?.preview]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormErrors([]);
    setApiError(null);

    if (!session) {
      router.replace("/login");
      return;
    }

    if (cooldownRemaining > 0) {
      setApiError(`次の生成まであと${cooldownRemaining}秒お待ちください`);
      return;
    }

    if (!userImage?.base64 || !clothImage?.base64) {
      setFormErrors(["自画像と服画像を選択してください"]);
      return;
    }

    const body = parseBody(bodyForm);
    const cloth = parseCloth(clothForm);

    const validationErrors: string[] = [];
    const bodyResult = bodySpecSchema.safeParse(body);
    if (!bodyResult.success) {
      bodyResult.error.errors.forEach((issue) => validationErrors.push(issue.message));
    }

    const clothResult = clothSpecSchema.safeParse(cloth);
    if (!clothResult.success) {
      clothResult.error.errors.forEach((issue) => validationErrors.push(issue.message));
    }

    if (validationErrors.length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/tryon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userImageB64: userImage.base64,
          clothImageB64: clothImage.base64,
          body: bodyResult.data,
          cloth: clothResult.data,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = json?.retryAfter ?? COOLDOWN_SECONDS;
          cooldownUntilRef.current = Date.now() + retryAfter * 1000;
          setCooldownRemaining(Math.ceil(retryAfter));
          setApiError(json?.error ?? "無料枠のクールダウン中です");
        } else if (response.status === 400) {
          setFormErrors(json?.errors ?? [json?.error ?? "入力内容を確認してください"]);
        } else {
          setApiError(json?.error ?? "生成に失敗しました");
        }
        return;
      }

      const { imageBase64 } = json as { imageBase64?: string };
      if (!imageBase64) {
        setApiError("生成結果が取得できませんでした");
        return;
      }

      const feedback = evaluateFit(bodyResult.data, clothResult.data);
      const storedResult: StoredResult = {
        imageBase64,
        feedback,
        body: bodyResult.data,
        cloth: clothResult.data,
        generatedAt: new Date().toISOString(),
      };

      await Promise.all([
        saveLastResult(storedResult),
        saveBodySpec(bodyResult.data),
        saveUserImage(userImage.base64),
      ]);

      setHasStoredResult(true);

      cooldownUntilRef.current = Date.now() + COOLDOWN_SECONDS * 1000;
      setCooldownRemaining(COOLDOWN_SECONDS);
      router.push("/result");
    } catch (err) {
      console.error(err);
      setApiError("生成リクエストに失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionLoading || !hydrated || !isAuthenticated) {
    return (
      <div className="page-centered">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Virtual Fit | Try</title>
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
              disabled={!hasStoredResult}
              onClick={() => {
                if (hasStoredResult) {
                  router.push("/result");
                }
              }}
            >
              <span className="material-icons">history</span>
              最後の結果を見る
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
        <form className="panel" onSubmit={handleSubmit}>
          <section className="section">
            <h2>1. 画像アップロード</h2>
            <div className="uploader-grid">
              <label className="uploader">
                <span>自画像（全身）</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    handleImageChange(event, setUserImage, saveUserImage)
                  }
                />
                {userImage?.preview && (
                  <Image
                    src={userImage.preview}
                    alt="自画像プレビュー"
                    width={userImage.width > 0 ? userImage.width : 512}
                    height={userImage.height > 0 ? userImage.height : 512}
                    unoptimized
                    className="image-preview"
                    style={{ maxHeight: 240 }}
                  />
                )}
              </label>
              <label className="uploader">
                <span>服画像</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleImageChange(event, setClothImage)}
                />
                {clothImage?.preview && (
                  <Image
                    src={clothImage.preview}
                    alt="服画像プレビュー"
                    width={clothImage.width > 0 ? clothImage.width : 512}
                    height={clothImage.height > 0 ? clothImage.height : 512}
                    unoptimized
                    className="image-preview"
                    style={{ maxHeight: 240 }}
                  />
                )}
              </label>
            </div>
          </section>

          <div className="section-lineup">
            <section className="section">
              <h2>2. あなたの体型（cm）</h2>
              <div className="form-grid">
                <label>
                  <span>身長</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={bodyForm.height}
                    className="input-3-digit"
                    onChange={handleBodyInput("height")}
                  />
                </label>
                <label>
                  <span>肩幅</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={bodyForm.shoulder}
                    className="input-2-digit"
                    onChange={handleBodyInput("shoulder")}
                  />
                </label>
              </div>
            </section>

            <section className="section">
              <h2>3. 服のサイズ（cm）</h2>
              <div className="form-grid">
                <label>
                  <span>肩幅</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={clothForm.shoulder}
                    className="input-2-digit"
                    onChange={handleClothInput("shoulder")}
                  />
                </label>
                <label>
                  <span>着丈</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={clothForm.length}
                    className="input-3-digit"
                    onChange={handleClothInput("length")}
                  />
                </label>
              </div>
            </section>
          </div>

          {formErrors.length > 0 && (
            <div className="error-box">
              {formErrors.map((message, index) => (
                <p key={`${message}-${index}`}>{message}</p>
              ))}
            </div>
          )}

          {apiError && <div className="error-box">{apiError}</div>}

          <div className="actions">
            <button
              type="submit"
              className="primary-button"
              disabled={submitting || cooldownRemaining > 0}
            >
              <span className="material-icons">
                {submitting ? "autorenew" : "checkroom"}
              </span>
              {submitting ? "生成中..." : "試着する"}
            </button>
            {cooldownRemaining > 0 && (
              <span className="cooldown">あと{cooldownRemaining}秒</span>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
