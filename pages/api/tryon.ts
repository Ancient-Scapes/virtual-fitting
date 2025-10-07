import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { tryOnRequestSchema } from "@/lib/schemas";

const MODEL_NAME = "gemini-2.5-flash-image";
const COOLDOWN_MS = 12_000;
const cooldownMap = new Map<string, number>();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const googleApiKey = process.env.GOOGLE_API_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabaseの環境変数が不足しています");
}

const supabaseServerClient = createClient(supabaseUrl, supabaseAnonKey);

type ErrorResponse = {
  error: string;
  errors?: string[];
  retryAfter?: number;
};

type SuccessResponse = {
  imageBase64: string;
};

function parseDataUrl(dataUrl: string) {
  const matches = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!matches) {
    throw new Error("Invalid data URL");
  }
  return {
    mimeType: matches[1],
    data: matches[2],
  };
}

async function callGeminiApi(
  userImageB64: string,
  clothImageB64: string,
  bodySummary: string,
  clothSummary: string
) {
  const userImage = parseDataUrl(userImageB64);
  const clothImage = parseDataUrl(clothImageB64);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${googleApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are an expert fashion visualizer generating a virtual try-on preview. Combine the person photo and the garment photo to produce a realistic single output image. Respect measurements and keep the background clean.`,
              },
              {
                inlineData: {
                  mimeType: userImage.mimeType,
                  data: userImage.data,
                },
              },
              {
                inlineData: {
                  mimeType: clothImage.mimeType,
                  data: clothImage.data,
                },
              },
              {
                text: `Body measurements (cm): ${bodySummary}`,
              },
              {
                text: `Garment measurements (cm): ${clothSummary}. Make the garment fit naturally on the body with realistic fabric drape.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.5,
        },
      }),
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: { message?: string };
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
              inlineData?: { data?: string; mimeType?: string };
            }>;
          };
        }>;
      }
    | null;

  if (!response.ok || !payload) {
    const message = payload?.error?.message ?? "Gemini API request failed";
    throw new Error(message);
  }
  const firstCandidate = payload.candidates?.[0];
  const parts = Array.isArray(firstCandidate?.content?.parts)
    ? (firstCandidate.content?.parts as Array<{
        text?: string;
        inlineData?: { data?: string; mimeType?: string };
      }>)
    : [];

  const imagePart = parts.find((part) => part.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    throw new Error("Gemini API response missing image data");
  }

  return `data:image/png;base64,${imagePart.inlineData.data}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse | SuccessResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.slice(7);
  const {
    data: { user },
    error: userError,
  } = await supabaseServerClient.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parseResult = tryOnRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "Invalid payload",
      errors: parseResult.error.issues.map((issue) => issue.message),
    });
  }

  if (!googleApiKey) {
    return res.status(500).json({ error: "GOOGLE_API_KEY is not configured" });
  }

  const now = Date.now();
  const lastRequest = cooldownMap.get(user.id) ?? 0;
  const elapsed = now - lastRequest;
  if (elapsed < COOLDOWN_MS) {
    const retryAfter = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    return res
      .status(429)
      .json({ error: "クールダウン中です", retryAfter });
  }

  cooldownMap.set(user.id, now);

  const {
    userImageB64,
    clothImageB64,
    body,
    cloth,
  } = parseResult.data;

  const bodySummary = `height ${body.height}, shoulder ${body.shoulder}`;
  const clothSummary = `shoulder ${cloth.shoulder}, length ${cloth.length}`;

  try {
    const imageBase64 = await callGeminiApi(
      userImageB64,
      clothImageB64,
      bodySummary,
      clothSummary
    );

    return res.status(200).json({ imageBase64 });
  } catch (error) {
    cooldownMap.set(user.id, now - COOLDOWN_MS);
    console.error(error);
    return res.status(500).json({ error: "生成処理に失敗しました" });
  }
}
