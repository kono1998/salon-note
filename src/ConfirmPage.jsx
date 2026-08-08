import React, { useEffect, useState } from "react";
import { supabase } from "./supabase.js";

export default function ConfirmPage() {
  const [status, setStatus] = useState("loading"); // loading | success | error

  useEffect(() => {
    // Supabaseがハッシュフラグメントのトークンを処理するのを待つ
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        // 認証完了したらすぐログアウトしてログイン画面へ促す
        supabase.auth.signOut();
        setStatus("success");
      }
    });

    // タイムアウト（トークンが無効など）
    const timer = setTimeout(() => {
      if (status === "loading") setStatus("error");
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const styles = {
    wrap: {
      minHeight: "100vh",
      background: "#fdf7f4",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif",
      padding: "20px",
    },
    card: {
      background: "#fff",
      borderRadius: 20,
      padding: "44px 32px",
      maxWidth: 400,
      width: "100%",
      textAlign: "center",
      boxShadow: "0 4px 32px rgba(0,0,0,0.08)",
      border: "1px solid #ede6e2",
    },
    logo: {
      fontFamily: "'Cormorant Garamond', serif",
      fontSize: 26,
      color: "#c8937a",
      letterSpacing: "0.2em",
      marginBottom: 28,
    },
    icon: {
      fontSize: 52,
      marginBottom: 16,
    },
    title: {
      fontFamily: "'Cormorant Garamond', serif",
      fontSize: 22,
      color: "#3d2c26",
      marginBottom: 12,
      letterSpacing: "0.06em",
    },
    body: {
      fontSize: 14,
      color: "#b09a92",
      lineHeight: 1.9,
      marginBottom: 28,
    },
    btn: {
      display: "inline-block",
      background: "#c8937a",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "14px 32px",
      fontSize: 15,
      fontFamily: "'Cormorant Garamond', serif",
      letterSpacing: "0.1em",
      cursor: "pointer",
      textDecoration: "none",
    },
    muted: {
      fontSize: 11,
      color: "#b09a92",
      marginTop: 20,
      opacity: 0.7,
    },
  };

  if (status === "loading") {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.logo}>✦ SALON NOTE</div>
          <div style={{ ...styles.icon }}>⏳</div>
          <div style={styles.title}>認証中...</div>
          <div style={styles.body}>メールアドレスを確認しています。<br/>しばらくお待ちください。</div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.logo}>✦ SALON NOTE</div>
          <div style={styles.icon}>⚠️</div>
          <div style={styles.title}>リンクが無効です</div>
          <div style={styles.body}>
            このリンクは期限切れか、すでに使用済みです。<br/>
            再度ログイン画面からお試しください。
          </div>
          <a href="/" style={styles.btn}>ログイン画面へ</a>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logo}>✦ SALON NOTE</div>
        <div style={styles.icon}>✅</div>
        <div style={styles.title}>認証が完了しました！</div>
        <div style={styles.body}>
          メールアドレスの確認が完了しました。<br/>
          ウェブアプリからログインしてご利用ください。
        </div>
        <a href="/" style={styles.btn}>ログインする</a>
        <div style={styles.muted}>Powered by sorato.</div>
      </div>
    </div>
  );
}
