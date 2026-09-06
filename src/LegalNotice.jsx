import React from "react";

const T = {
  bg: "#fdf7f4", card: "#ffffff", border: "#ede6e2",
  accent: "#c8937a", sub: "#a0897a", text: "#3d2c26",
  muted: "#b09a92"
};

// ここに掲載する内容は「特定商取引法に基づく表記」です。
// 通信販売でお金を受け取る場合、法律で表示が義務付けられている項目です。
//
// 【重要】省略できるのは「所在地」「電話番号」の2つだけです。
// 「氏名」は法律上、屋号やニックネームだけでは足りず、本名(開業届に書いた氏名)の記載が必須です。
const SELLER_NAME = "友西このみ";
const CONTACT_EMAIL = "tomonishi.sorato@gmail.com";

const rows = [
  ["販売事業者", SELLER_NAME],
  ["運営統括責任者", SELLER_NAME],
  ["所在地・電話番号", "ご請求をいただいた場合には、遅滞なく開示いたします。"],
  ["メールアドレス", CONTACT_EMAIL],
  ["販売価格", "月額390円（税込）"],
  ["商品代金以外に必要な料金", "なし(インターネット接続にかかる通信費はお客様のご負担となります)"],
  ["お支払い方法", "クレジットカード決済(Stripeを利用)"],
  ["お支払い時期", "ご登録時に決済されます。以降は毎月同じ日に自動更新・自動決済されます。"],
  ["サービス提供時期", "決済完了後、直ちにご利用いただけます。"],
  ["返品・キャンセルについて", "デジタルサービスの性質上、お支払い済みの料金の返金は原則として行っておりません。次回更新日の前日までにマイページより解約手続きを行うことで、翌月以降のご請求を停止できます。"],
  ["動作環境", "インターネット接続環境、および対応ブラウザ(Google Chrome、Safari 最新版を推奨)"],
];

export default function LegalNotice({ onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif", padding: "40px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: T.accent, letterSpacing: "0.15em" }}>✦ SALON NOTE</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>特定商取引法に基づく表記</div>
        </div>

        <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, overflow: "hidden" }}>
          {rows.map(([label, value], i) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "16px 20px", borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <div style={{ fontSize: 12, color: T.sub, letterSpacing: "0.05em" }}>{label}</div>
              <div style={{ fontSize: 14, color: T.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{value}</div>
            </div>
          ))}
        </div>

        {onBack && (
          <button onClick={onBack} style={{ display: "block", margin: "24px auto 0", background: "none", border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 24px", fontSize: 13, color: T.muted, cursor: "pointer", fontFamily: "inherit" }}>
            ← 戻る
          </button>
        )}
      </div>
    </div>
  );
}
