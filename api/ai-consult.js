import { createClient } from "@supabase/supabase-js";

// Vercelの環境変数に以下を登録してください（コードには書きません）:
//   ANTHROPIC_API_KEY         … Anthropic Consoleで発行したAPIキー
//   SUPABASE_URL              … 既存のVITE_SUPABASE_URLと同じ値でOK
//   SUPABASE_SERVICE_ROLE_KEY … api/stripe-webhook.js と同じもの（未設定なら追加してください）
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    // ログイン済みユーザーだけが使えるようにする（APIキーの無断利用・課金爆発を防ぐため）
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "unauthorized" });
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: "unauthorized" });

    const { question } = req.body || {};
    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "question is required" });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is not set");
      return res.status(500).json({ error: "server_not_configured" });
    }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: "あなたはネイルサロン管理アプリ「SALON NOTE」のサポートアシスタントです。アプリの使い方・機能や、ネイルサロン運営に関するちょっとした相談に、やさしく簡潔な日本語で答えてください。長くなりすぎないよう要点を絞り、わからないことは正直に「わかりません」と伝えてください。",
        messages: [{ role: "user", content: question.slice(0, 2000) }],
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("Anthropic API error:", r.status, errText);
      return res.status(502).json({ error: "upstream_error" });
    }

    const data = await r.json();
    const answer = data?.content?.[0]?.text || "";
    return res.status(200).json({ answer });
  } catch (err) {
    console.error("ai-consult error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
}
