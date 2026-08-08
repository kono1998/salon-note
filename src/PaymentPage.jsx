import React, { useState } from "react";
import { supabase } from "./supabase.js";

const T = {
  bg: "#fdf7f4", card: "#ffffff", border: "#ede6e2",
  accent: "#c8937a", sub: "#a0897a", text: "#3d2c26",
  muted: "#b09a92", danger: "#cc7070"
};

export default function PaymentPage({ session, onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCheckout = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session.user.email,
          userId: session.user.id,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("決済ページの読み込みに失敗しました");
      }
    } catch (e) {
      setError("エラーが発生しました。もう一度お試しください。");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif", padding:20 }}>
      <div style={{ width:"100%", maxWidth:420 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, color:T.accent, letterSpacing:"0.2em" }}>✦ SALON NOTE</div>
        </div>

        <div style={{ background:T.card, borderRadius:20, padding:"32px 28px", border:`1px solid ${T.border}`, boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
          <div style={{ textAlign:"center", marginBottom:24 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🌷</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:T.text, marginBottom:8 }}>プレミアムプランへアップグレード</div>
            <div style={{ fontSize:13, color:T.muted, lineHeight:1.8 }}>顧客数が10人を超えました。<br/>プレミアムプランで無制限にご利用いただけます。</div>
          </div>

          {/* 料金カード */}
          <div style={{ background:T.accent+"12", border:`1px solid ${T.accent}40`, borderRadius:14, padding:"20px 24px", marginBottom:24, textAlign:"center" }}>
            <div style={{ fontSize:12, color:T.sub, marginBottom:4, letterSpacing:"0.1em", fontFamily:"'Cormorant Garamond',serif" }}>月額プラン</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:42, color:T.accent, fontWeight:"bold" }}>¥390</div>
            <div style={{ fontSize:12, color:T.muted, marginTop:2 }}>/ 月（税込）・いつでも解約可能</div>
          </div>

          {/* 特典リスト */}
          <div style={{ marginBottom:24 }}>
            {[
              "顧客登録 無制限",
              "カルテ・写真添付",
              "売上グラフ・詳細レポート",
              "CSV出力・確定申告用データ",
              "お客様自己登録QRコード",
              "スタッフ招待・複数人利用",
              "バックアップ・復元",
            ].map((item, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:i < 6 ? `1px solid ${T.border}` : "none" }}>
                <span style={{ color:T.accent, fontSize:14 }}>✓</span>
                <span style={{ fontSize:13, color:T.text }}>{item}</span>
              </div>
            ))}
          </div>

          {error && (
            <div style={{ fontSize:12, color:T.danger, background:T.danger+"18", borderRadius:8, padding:"8px 12px", marginBottom:12 }}>
              {error}
            </div>
          )}

          <button onClick={handleCheckout} disabled={loading} style={{ width:"100%", background:loading?T.muted:T.accent, color:"#fff", border:"none", borderRadius:12, padding:"16px", fontSize:16, fontFamily:"'Cormorant Garamond',serif", letterSpacing:"0.1em", cursor:loading?"default":"pointer", marginBottom:12 }}>
            {loading ? "読み込み中..." : "カード決済で始める →"}
          </button>

          <button onClick={onBack} style={{ width:"100%", background:"none", border:`1px solid ${T.border}`, borderRadius:12, padding:"12px", fontSize:13, color:T.muted, cursor:"pointer", fontFamily:"inherit" }}>
            戻る（無料プランで続ける）
          </button>

          <div style={{ fontSize:10, color:T.muted, textAlign:"center", marginTop:16, lineHeight:1.7, opacity:0.8 }}>
            Stripeの安全な決済ページに移動します。<br/>
            クレジットカード情報はStripeが管理します。
          </div>
        </div>
        <div style={{ textAlign:"center", marginTop:20, fontSize:10, color:T.muted, opacity:0.6 }}>Powered by sorato.</div>
      </div>
    </div>
  );
}
