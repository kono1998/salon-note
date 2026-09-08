// Vercelの環境変数に以下を登録してください（コードには書きません）:
//   RESEND_API_KEY    … Resend (resend.com) で発行したAPIキー
//   RESEND_FROM_EMAIL … 送信元アドレス（例: "SALON NOTE <hello@あなたの独自ドメイン>"）
//                        ※Resendでドメイン認証（SPF/DKIM）が済んだドメインのアドレスが必要です。
//                          未認証の場合、Resendの制限によりアカウント所有者以外には送信できません。
//   両方が未設定、またはResend側でエラーが出た場合も登録処理自体は失敗させず、静かにスキップします。

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const { email } = req.body || {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email is required" });
    }

    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
      // 未設定の場合は何もせず正常終了（登録処理をブロックしない）
      return res.status(200).json({ skipped: true, reason: "email_not_configured" });
    }

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: "SALON NOTEにご登録いただきありがとうございます！",
        text: "この度はSALON NOTEにご登録いただき、誠にありがとうございます。\n\nこれからサロン運営のお役に立てるよう頑張ります。\n使い方で分からないことがあれば、アプリ内の「ご意見・ご要望」からいつでもお気軽にご連絡ください。\n\nSALON NOTE",
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("Resend API error:", r.status, errText);
      return res.status(200).json({ skipped: true, reason: "send_failed" });
    }

    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error("send-welcome-email error:", err);
    return res.status(200).json({ skipped: true, reason: "internal_error" });
  }
}
