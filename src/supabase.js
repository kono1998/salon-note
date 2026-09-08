import { createClient } from "@supabase/supabase-js";

// ── ログイン保持の設定 ──────────────────────────────────────────
// 「ログイン状態を保持する」がオンならブラウザを閉じても残るlocalStorageに、
// オフならタブを閉じると消えるsessionStorageにログイン情報を保存する。
const REMEMBER_KEY = "sn4_remember_me";

export const getRememberMe = () => {
  try { return localStorage.getItem(REMEMBER_KEY) !== "0"; } catch { return true; }
};
export const setRememberMe = (remember) => {
  try { localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0"); } catch {}
};

const dynamicStorage = {
  getItem: (key) => {
    try {
      const store = getRememberMe() ? localStorage : sessionStorage;
      return store.getItem(key);
    } catch { return null; }
  },
  setItem: (key, value) => {
    try {
      const store = getRememberMe() ? localStorage : sessionStorage;
      store.setItem(key, value);
      // 保持オフの時にlocalStorage側に古いセッションが残らないよう掃除
      if (!getRememberMe()) localStorage.removeItem(key);
    } catch {}
  },
  removeItem: (key) => {
    try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch {}
  },
};

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { storage: dynamicStorage, persistSession: true, autoRefreshToken: true } }
);

// 一時デバッグ用（後で削除）
if (typeof window !== "undefined") window.__sn_supabase = supabase;
