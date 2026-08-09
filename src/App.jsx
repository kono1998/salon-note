import React, { useState, useRef, useEffect } from "react";
import PaymentPage from "./PaymentPage.jsx";
import { supabase } from "./supabase.js";

const LS = {
  get: (k, fb) => { try { const d = localStorage.getItem(k); return d ? JSON.parse(d) : fb; } catch { return fb; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayStr = () => new Date().toISOString().slice(0, 10);
const currentYear = () => new Date().getFullYear();

const THEMES = {
  sakura:   { name:"さくら",    bg:"#fdf7f4", card:"#ffffff", border:"#ede6e2", accent:"#c8937a", sub:"#a0897a", text:"#3d2c26", muted:"#b09a92", danger:"#cc7070" },
  ivory:    { name:"アイボリー", bg:"#f9f6f0", card:"#fffef9", border:"#e8e0d0", accent:"#8f7a5a", sub:"#7a6a50", text:"#2c2416", muted:"#a09070", danger:"#b07060" },
  sage:     { name:"セージ",    bg:"#f4f7f4", card:"#ffffff", border:"#dde8dd", accent:"#5a8a5a", sub:"#4a7a4a", text:"#1e2e1e", muted:"#70906e", danger:"#a06060" },
  charcoal: { name:"ネイビー",   bg:"#0f1923", card:"#172030", border:"#ffffff33", accent:"#c8a84b", sub:"#c0b080", text:"#ffffff", muted:"#ffffffaa", danger:"#e07070" },
};

function useIMEInput(extVal, onChange) {
  const [local, setLocal] = useState(extVal);
  const composing = useRef(false);
  const prevExt = useRef(extVal);
  if (prevExt.current !== extVal && !composing.current) { prevExt.current = extVal; if (local !== extVal) setLocal(extVal); }
  return {
    value: local,
    onChange: e => { setLocal(e.target.value); if (!composing.current) onChange(e.target.value); },
    onCompositionStart: () => { composing.current = true; },
    onCompositionEnd: e => { composing.current = false; setLocal(e.target.value); onChange(e.target.value); },
  };
}
function IMEInput({ value, onChange, placeholder, style={} }) {
  const ime = useIMEInput(value, onChange);
  return <input placeholder={placeholder} {...ime} style={style} />;
}
function IMEArea({ value, onChange, placeholder, rows=3, style={} }) {
  const ime = useIMEInput(value, onChange);
  return <textarea placeholder={placeholder} rows={rows} {...ime} style={style} />;
}

function PaymentAddForm({ payments, savePayments, base, T, Btn }) {
  const [v, setV] = React.useState("");
  const add = () => {
    const trimmed = v.trim();
    if (!trimmed || payments.includes(trimmed)) return;
    savePayments([...payments, trimmed]);
    setV("");
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
      <input value={v} onChange={e => setV(e.target.value)} placeholder="例: PayPay" style={base}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      <Btn full onClick={add}>追加</Btn>
    </div>
  );
}

// ── ネイルデザイン料金 自動計算 ──────────────────────────────────
const DEFAULT_PRICING = {
  base_fee: 6500, diff_onecolor: 100, diff_low: 300, diff_mid: 500, diff_high: 800, diff_extreme: 1000,
  mirror_onecolor: 200, parts_normal: 300, parts_small: 50, parts_expensive_margin: 50,
  protect_menu: 200, chip_extension: 200,
};
const DIFF_KEYS = ["ワンカラー", "低", "中", "高", "激高"];
const FINGER_LABELS = ["親指", "人差し指", "中指", "薬指", "小指"];
const FINGER_HEIGHTS = [64, 84, 96, 86, 66];

function makeDefaultFinger(no, hand) {
  return { finger_no:no, hand, difficulty:"ワンカラー", onecolor_mirror:false, other_mirror_amount:0,
    airbrush_amount:0, parts_normal_count:0, parts_small_count:0, parts_expensive_total:0,
    protect_menu:false, chip_extension:false };
}
function defaultFingerSet(hand) { return [1,2,3,4,5].map(n => makeDefaultFinger(n, hand)); }
function nailDiffMap(s) { return { ワンカラー:s.diff_onecolor, 低:s.diff_low, 中:s.diff_mid, 高:s.diff_high, 激高:s.diff_extreme }; }
function calcFingerTotal(f, s) {
  const map = nailDiffMap(s);
  let total = map[f.difficulty] ?? 0;
  if (f.difficulty === "ワンカラー" && f.onecolor_mirror) total += s.mirror_onecolor - s.diff_onecolor;
  total += f.other_mirror_amount || 0;
  total += f.airbrush_amount || 0;
  total += (f.parts_normal_count||0) * s.parts_normal;
  total += (f.parts_small_count||0) * s.parts_small;
  if (f.parts_expensive_total > 0) total += f.parts_expensive_total + s.parts_expensive_margin;
  if (f.protect_menu) total += s.protect_menu;
  if (f.chip_extension) total += s.chip_extension;
  return total;
}
function nailYen(n) { return `¥${(n||0).toLocaleString()}`; }
function fingerBadge(f) {
  const extras = [];
  if (f.onecolor_mirror || f.other_mirror_amount>0) extras.push("mirror");
  if (f.airbrush_amount>0) extras.push("エア");
  if (f.parts_normal_count>0||f.parts_small_count>0||f.parts_expensive_total>0) extras.push("パーツ");
  if (f.protect_menu) extras.push("保護");
  if (f.chip_extension) extras.push("長さ");
  return extras.length ? `${f.difficulty}+${extras.length}` : f.difficulty;
}

function FingerIllustration({ finger, settings, height, onTap }) {
  const total = calcFingerTotal(finger, settings);
  const isDefault = fingerBadge(finger) === "ワンカラー";
  return (
    <button onClick={onTap} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, background:"none", border:"none", cursor:"pointer", marginTop:96-height }}>
      <div style={{ width:44, height, border:`2px solid ${isDefault?"#d8d0ca":"#c8937a"}`, background:isDefault?"#fff":"#fdf0ec", borderRadius:"50% 50% 10px 10px / 60% 60% 10px 10px" }} />
      <span style={{ fontSize:10, color:"#a0897a" }}>{FINGER_LABELS[finger.finger_no-1]}</span>
      <span style={{ fontSize:10, fontWeight:"bold", borderRadius:20, padding:"2px 6px", background:isDefault?"#f0eae5":"#c8937a", color:isDefault?"#a0897a":"#fff" }}>{fingerBadge(finger)}</span>
      <span style={{ fontSize:10, color:"#b09a92" }}>{nailYen(total)}</span>
    </button>
  );
}

function NailNumField({ label, value, onChange }) {
  return (
    <label style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, background:"#fdf7f4", borderRadius:12, padding:"8px 12px" }}>
      <span style={{ fontSize:13, color:"#7a6a60" }}>{label}</span>
      <input type="number" min={0} value={value} onChange={e=>onChange(Math.max(0, Number(e.target.value)||0))}
        style={{ width:80, borderRadius:8, border:"1px solid #ede6e2", padding:"6px 8px", textAlign:"right", fontSize:13 }} />
    </label>
  );
}

function FingerEditSheet({ finger, settings, onDone, onCancel }) {
  const [f, setF] = useState(finger);
  const total = calcFingerTotal(f, settings);
  const map = nailDiffMap(settings);
  return (
    <div style={{ position:"fixed", inset:0, zIndex:70, display:"flex", alignItems:"flex-end", justifyContent:"center", background:"rgba(30,20,15,0.4)" }} onClick={e=>{ if(e.target===e.currentTarget) onCancel(); }}>
      <div style={{ width:"100%", maxWidth:440, maxHeight:"88vh", overflowY:"auto", background:"#fff", borderRadius:"22px 22px 0 0", padding:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, color:"#3d2c26" }}>{f.hand}・{FINGER_LABELS[f.finger_no-1]}の編集</div>
          <div style={{ fontSize:18, fontWeight:"bold", color:"#c8937a" }}>{nailYen(total)}</div>
        </div>
        <div style={{ fontSize:11, color:"#a0897a", marginBottom:6 }}>難易度（1つ選択）</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:14 }}>
          {DIFF_KEYS.map(k => (
            <button key={k} onClick={() => { const patch={difficulty:k}; if(k!=="ワンカラー"){patch.onecolor_mirror=false;} else {patch.other_mirror_amount=0;} setF({...f,...patch}); }}
              style={{ borderRadius:12, border:`1px solid ${f.difficulty===k?"#c8937a":"#ede6e2"}`, background:f.difficulty===k?"#c8937a":"#fff", color:f.difficulty===k?"#fff":"#3d2c26", padding:"8px 4px", fontSize:12, fontWeight:"bold" }}>
              {k}<div style={{ fontSize:10, fontWeight:"normal", opacity:0.85 }}>{nailYen(map[k])}</div>
            </button>
          ))}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
          {f.difficulty==="ワンカラー" ? (
            <label style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fdf7f4", borderRadius:12, padding:"8px 12px" }}>
              <span style={{ fontSize:13, color:"#7a6a60" }}>mirror加算（+{nailYen(settings.mirror_onecolor-settings.diff_onecolor)}）</span>
              <input type="checkbox" checked={f.onecolor_mirror} onChange={e=>setF({...f,onecolor_mirror:e.target.checked})} style={{ width:18, height:18 }} />
            </label>
          ) : (
            <NailNumField label="mirror加算（手入力）" value={f.other_mirror_amount} onChange={v=>setF({...f,other_mirror_amount:v})} />
          )}
          <NailNumField label="エアブラシ加算（手入力）" value={f.airbrush_amount} onChange={v=>setF({...f,airbrush_amount:v})} />
          <NailNumField label={`通常パーツ 個数（${nailYen(settings.parts_normal)}/個）`} value={f.parts_normal_count} onChange={v=>setF({...f,parts_normal_count:v})} />
          <NailNumField label={`極小パーツ 個数（${nailYen(settings.parts_small)}/個）`} value={f.parts_small_count} onChange={v=>setF({...f,parts_small_count:v})} />
          <NailNumField label={`高額パーツ 仕入合計（+${nailYen(settings.parts_expensive_margin)}/本）`} value={f.parts_expensive_total} onChange={v=>setF({...f,parts_expensive_total:v})} />
          <label style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fdf7f4", borderRadius:12, padding:"8px 12px" }}>
            <span style={{ fontSize:13, color:"#7a6a60" }}>保護メニュー（{nailYen(settings.protect_menu)}）</span>
            <input type="checkbox" checked={f.protect_menu} onChange={e=>setF({...f,protect_menu:e.target.checked})} style={{ width:18, height:18 }} />
          </label>
          <label style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fdf7f4", borderRadius:12, padding:"8px 12px" }}>
            <span style={{ fontSize:13, color:"#7a6a60" }}>長さだし（{nailYen(settings.chip_extension)}）</span>
            <input type="checkbox" checked={f.chip_extension} onChange={e=>setF({...f,chip_extension:e.target.checked})} style={{ width:18, height:18 }} />
          </label>
        </div>
        <button onClick={()=>onDone(f)} style={{ width:"100%", background:"#c8937a", color:"#fff", border:"none", borderRadius:14, padding:"13px", fontSize:15, fontFamily:"'Cormorant Garamond',serif", fontWeight:"bold" }}>編集完了</button>
      </div>
    </div>
  );
}

function NailPricingSettingsPanel({ settings, onChange, onClose }) {
  const rows = [
    ["base_fee","基本料金"], ["diff_onecolor","難易度：ワンカラー"], ["diff_low","難易度：低"],
    ["diff_mid","難易度：中"], ["diff_high","難易度：高"], ["diff_extreme","難易度：激高"],
    ["mirror_onecolor","ワンカラーmirror固定額"], ["parts_normal","通常パーツ単価"], ["parts_small","極小パーツ単価"],
    ["parts_expensive_margin","高額パーツ上乗せ額"], ["protect_menu","保護メニュー"], ["chip_extension","長さだし"],
  ];
  return (
    <div style={{ position:"fixed", inset:0, zIndex:80, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(30,20,15,0.45)", padding:16 }}>
      <div style={{ width:"100%", maxWidth:420, maxHeight:"85vh", overflowY:"auto", background:"#fff", borderRadius:20, padding:20 }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, marginBottom:14, color:"#3d2c26" }}>料金設定</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {rows.map(([key,label]) => (
            <label key={key} style={{ display:"flex", flexDirection:"column", gap:4, fontSize:11, color:"#a0897a" }}>
              {label}
              <input type="number" value={settings[key]} onChange={e=>onChange({...settings,[key]:Number(e.target.value)||0})}
                style={{ borderRadius:8, border:"1px solid #ede6e2", padding:"6px 8px", fontSize:13 }} />
            </label>
          ))}
        </div>
        <button onClick={onClose} style={{ width:"100%", marginTop:16, background:"#c8937a", color:"#fff", border:"none", borderRadius:14, padding:"12px", fontSize:14, fontFamily:"'Cormorant Garamond',serif" }}>閉じる</button>
      </div>
    </div>
  );
}

function NailPricingModal({ settings, onSaveSettings, onConfirm, onClose }) {
  const [target, setTarget] = useState("hand");
  const [handLeft, setHandLeft] = useState(defaultFingerSet("左手"));
  const [handRight, setHandRight] = useState(defaultFingerSet("右手"));
  const [footLeft, setFootLeft] = useState(defaultFingerSet("左足"));
  const [footRight, setFootRight] = useState(defaultFingerSet("右足"));
  const [editing, setEditing] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const left = target==="hand" ? handLeft : footLeft;
  const right = target==="hand" ? handRight : footRight;
  const setLeft = target==="hand" ? setHandLeft : setFootLeft;
  const setRight = target==="hand" ? setHandRight : setFootRight;

  const fingersTotal = [...handLeft, ...handRight, ...footLeft, ...footRight].reduce((sum,f) => sum + calcFingerTotal(f, settings), 0);
  const grandTotal = settings.base_fee + fingersTotal;

  const openEdit = (side, idx) => setEditing({ side, idx });
  const closeEdit = (updated) => {
    if (editing.side === "left") setLeft(prev => prev.map((f,i)=> i===editing.idx?updated:f));
    else setRight(prev => prev.map((f,i)=> i===editing.idx?updated:f));
    setEditing(null);
  };
  const editingFinger = editing ? (editing.side==="left" ? left[editing.idx] : right[editing.idx]) : null;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:60, background:"#fdf7f4", overflowY:"auto" }}>
      <div style={{ position:"sticky", top:0, background:"#fffdfb", borderBottom:"1px solid #ede6e2", padding:"14px 16px", zIndex:5 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div>
            <div style={{ fontSize:10, letterSpacing:"0.15em", color:"#c8937a" }}>SALON NOTE</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, color:"#3d2c26" }}>デザイン料金 自動計算</div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={()=>setShowSettings(true)} style={{ borderRadius:10, border:"none", background:"#3d2c26", color:"#fff", padding:"7px 12px", fontSize:11 }}>料金設定</button>
            <button onClick={onClose} style={{ borderRadius:10, border:"1px solid #ede6e2", background:"#fff", color:"#a0897a", padding:"7px 12px", fontSize:11 }}>閉じる</button>
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {[["hand","ハンド"],["foot","フット"]].map(([key,label]) => (
            <button key={key} onClick={()=>setTarget(key)} style={{ flex:1, borderRadius:12, border:"none", padding:"9px", fontSize:13, fontWeight:"bold", background:target===key?"#c8937a":"#f0eae5", color:target===key?"#fff":"#a0897a" }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 120px" }}>
        <div style={{ fontSize:11, color:"#a0897a", marginBottom:6 }}>{target==="hand"?"左手":"左足"}・タップして編集</div>
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"center", gap:10, background:"#fff", border:"1px solid #ede6e2", borderRadius:16, padding:14, marginBottom:20 }}>
          {left.map((f,i) => <FingerIllustration key={`L${f.finger_no}`} finger={f} settings={settings} height={FINGER_HEIGHTS[i]} onTap={()=>openEdit("left",i)} />)}
        </div>
        <div style={{ fontSize:11, color:"#a0897a", marginBottom:6 }}>{target==="hand"?"右手":"右足"}・タップして編集</div>
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"center", gap:10, background:"#fff", border:"1px solid #ede6e2", borderRadius:16, padding:14 }}>
          {right.map((f,i) => <FingerIllustration key={`R${f.finger_no}`} finger={f} settings={settings} height={FINGER_HEIGHTS[i]} onTap={()=>openEdit("right",i)} />)}
        </div>
      </div>

      <div style={{ position:"fixed", left:0, right:0, bottom:0, background:"#fff", borderTop:"1px solid #ede6e2", padding:"12px 16px", zIndex:5 }}>
        <div style={{ maxWidth:480, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:11, color:"#a0897a" }}>基本料金 {nailYen(settings.base_fee)} ＋ 指合計 {nailYen(fingersTotal)}</div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:19, fontWeight:"bold", color:"#c8937a" }}>{nailYen(grandTotal)}</span>
            <button onClick={()=>onConfirm(grandTotal)} style={{ borderRadius:12, border:"none", background:"#3d2c26", color:"#fff", padding:"10px 16px", fontSize:13, fontWeight:"bold" }}>登録完了</button>
          </div>
        </div>
      </div>

      {editingFinger && <FingerEditSheet finger={editingFinger} settings={settings} onDone={closeEdit} onCancel={()=>setEditing(null)} />}
      {showSettings && <NailPricingSettingsPanel settings={settings} onChange={onSaveSettings} onClose={()=>setShowSettings(false)} />}
    </div>
  );
}

// ── Auth Screen ──────────────────────────────────────────────────
function AuthScreen() {
  const themeKey = LS.get("sn4_theme", "sakura");
  const T = THEMES[themeKey] || THEMES.sakura;
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [inviteToken] = useState(() => new URLSearchParams(window.location.search).get("invite") || "");

  const base = { width:"100%", padding:"12px 14px", border:`1px solid ${T.border}`, borderRadius:10, fontSize:15, background:T.bg, color:T.text, outline:"none", boxSizing:"border-box", fontFamily:"inherit", display:"block" };

  const handleLogin = async () => {
    if (!email || !password) { setError("メールとパスワードを入力してください"); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError("メールアドレスまたはパスワードが間違っています");
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!email || !password) { setError("メールとパスワードを入力してください"); return; }
    if (password.length < 6) { setError("パスワードは6文字以上にしてください"); return; }
    setLoading(true); setError("");
    if (inviteToken) {
      const { data: inv } = await supabase.from("invitations").select("*").eq("token", inviteToken).eq("used", false).single();
      if (!inv) { setError("招待コードが無効か、すでに使用済みです"); setLoading(false); return; }
    }
    const { data, error: err } = await supabase.auth.signUp({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }
    const role = inviteToken ? "staff" : "owner";
    const status = inviteToken ? "pending" : "active";
    await supabase.from("salon_members").insert({ user_id: data.user?.id, role, status });
    if (inviteToken) await supabase.from("invitations").update({ used: true }).eq("token", inviteToken);
    setLoading(false);
    // 登録完了アラートを出してからそのままアプリへ
    alert("登録が完了しました！\nSALON NOTE へようこそ 🌷");
    // セッションが自動で確立されているのでそのまま画面が切り替わる
  };

  const handleForgot = async () => {
    if (!email) { setError("メールアドレスを入力してください"); return; }
    setLoading(true); setError("");
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setMsg("パスワードリセットメールを送信しました");
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif", padding:"20px" }}>
      <div style={{ width:"100%", maxWidth:380 }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, color:T.accent, letterSpacing:"0.2em" }}>✦ SALON</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, color:T.accent, letterSpacing:"0.2em", marginTop:-6 }}>NOTE</div>
          <div style={{ fontSize:11, color:T.muted, marginTop:8, letterSpacing:"0.1em" }}>サロン管理システム</div>
        </div>
        <div style={{ background:T.card, borderRadius:16, padding:"28px 24px", border:`1px solid ${T.border}`, boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
          {mode !== "forgot" && (
            <div style={{ display:"flex", marginBottom:22, border:`1px solid ${T.border}`, borderRadius:10, overflow:"hidden" }}>
              {[["login","ログイン"],["signup","新規登録"]].map(([m,l]) => (
                <button key={m} onClick={() => { setMode(m); setError(""); setMsg(""); }} style={{ flex:1, padding:"10px", background:mode===m?T.accent:"transparent", color:mode===m?"#fff":T.muted, border:"none", cursor:"pointer", fontSize:13, fontFamily:"'Cormorant Garamond',serif", letterSpacing:"0.06em" }}>{l}</button>
              ))}
            </div>
          )}
          {mode === "forgot" && (
            <div style={{ marginBottom:18 }}>
              <button onClick={() => { setMode("login"); setError(""); setMsg(""); }} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:13, padding:0 }}>← ログインに戻る</button>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:T.accent, marginTop:10 }}>パスワードをリセット</div>
            </div>
          )}
          {inviteToken && mode === "signup" && (
            <div style={{ background:T.accent+"18", border:`1px solid ${T.accent}40`, borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:12, color:T.accent }}>
              ✦ 招待リンクから登録しています
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="メールアドレス" type="email" style={base} />
            {mode !== "forgot" && (
              <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="パスワード（6文字以上）" type="password" style={base}
                onKeyDown={e => { if (e.key==="Enter") mode==="login"?handleLogin():handleSignup(); }} />
            )}
            {error && <div style={{ fontSize:12, color:T.danger, padding:"8px 12px", background:T.danger+"18", borderRadius:8 }}>{error}</div>}
            {msg   && <div style={{ fontSize:12, color:T.accent, padding:"8px 12px", background:T.accent+"18", borderRadius:8 }}>{msg}</div>}
            <button onClick={mode==="login"?handleLogin:mode==="signup"?handleSignup:handleForgot} disabled={loading}
              style={{ background:loading?T.muted:T.accent, color:"#fff", border:"none", borderRadius:10, padding:"14px", cursor:loading?"default":"pointer", fontSize:15, fontFamily:"'Cormorant Garamond',serif", letterSpacing:"0.1em", marginTop:4 }}>
              {loading?"処理中...":mode==="login"?"ログイン":mode==="signup"?"登録する":"送信する"}
            </button>
            {mode === "login" && (
              <button onClick={() => { setMode("forgot"); setError(""); setMsg(""); }} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:12, textAlign:"center" }}>
                パスワードを忘れた方
              </button>
            )}
          </div>
        </div>
        <div style={{ textAlign:"center", marginTop:20, fontSize:10, color:T.muted, opacity:0.6 }}>Powered by sorato.</div>
      </div>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────
export default function SalonApp() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [myRole, setMyRole] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const [subStatus, setSubStatus] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    if (!session) { setMyRole(null); setSubStatus(null); return; }
    supabase.from("salon_members").select("role,status").eq("user_id", session.user.id).single()
      .then(({ data }) => setMyRole(data));
    supabase.from("subscriptions").select("status").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => {
        setSubStatus(data?.status || "inactive");
      });
  }, [session]);

  if (authLoading) {
    const T = THEMES[LS.get("sn4_theme","sakura")] || THEMES.sakura;
    return <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:T.muted }}>読み込み中...</div>;
  }
  if (!session) return <AuthScreen />;
  if (myRole && myRole.status === "pending") {
    const T = THEMES[LS.get("sn4_theme","sakura")] || THEMES.sakura;
    return (
      <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Hiragino Kaku Gothic ProN',sans-serif", padding:20 }}>
        <div style={{ textAlign:"center", background:T.card, borderRadius:16, padding:32, maxWidth:360, border:`1px solid ${T.border}` }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:T.accent, marginBottom:12 }}>✦ 承認待ち</div>
          <div style={{ fontSize:13, color:T.muted, lineHeight:1.8, marginBottom:20 }}>オーナーの承認をお待ちください。<br/>承認後にご利用いただけます。</div>
          <button onClick={() => supabase.auth.signOut()} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:9, padding:"10px 20px", color:T.muted, cursor:"pointer", fontSize:13 }}>ログアウト</button>
        </div>
      </div>
    );
  }
  if (showPayment) {
    return <PaymentPage session={session} onBack={() => setShowPayment(false)} />;
  }
  return <MainApp session={session} myRole={myRole} subStatus={subStatus} onShowPayment={() => setShowPayment(true)} />;
}

// ── Main App ─────────────────────────────────────────────────────
function MainApp({ session, myRole, subStatus, onShowPayment }) {
  const [clients,   setClients]   = useState([]);
  const [kartes,    setKartes]    = useState([]);
  const [menus,     setMenus]     = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [themeKey,  setThemeKey]  = useState(() => LS.get("sn4_theme", "sakura"));
  const [payments,  setPayments]  = useState(["現金","クレジット","電子マネー"]);
  const [salonInfo, setSalonInfo] = useState({ name:"", genre:"" });
  const [showBackupAlert, setShowBackupAlert] = useState(false);
  const T = THEMES[themeKey] || THEMES.sakura;

  const [tab, setTab] = useState("clients");
  const [pending, setPending] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [clientDirty, setClientDirty] = useState(false);
  const [karteDirty, setKarteDirty] = useState(false);
  const [members, setMembers] = useState([]);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const isOwner = myRole?.role === "owner";

  const [showClientModal, setShowClientModal] = useState(false);
  const [showKarteModal,  setShowKarteModal]  = useState(false);
  const [editClientId, setEditClientId] = useState(null);
  const [editKarteId,  setEditKarteId]  = useState(null);

  const EMPTY_C = { name:"", phone:"", email:"", birthday:"", allergy:"", notes:"", memo:"" };
  const EMPTY_K = { clientId:"", date:todayStr(), menuId:"", price:"", treatMemo:"", talkMemo:"", photo:"" };
  const [cf, setCf] = useState(EMPTY_C);
  const [kf, setKf] = useState(EMPTY_K);

  const [clientSearch, setClientSearch] = useState("");
  const [detailId,     setDetailId]     = useState(null);
  const [pickerQ,      setPickerQ]      = useState("");
  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [showTplPicker, setShowTplPicker] = useState(false);

  const [calYM,  setCalYM]  = useState(() => { const d = new Date(); return { y:d.getFullYear(), m:d.getMonth() }; });
  const [calSel, setCalSel] = useState(todayStr());
  const [cmsYear,  setCmsYear]  = useState(currentYear());
  const [graphYear, setGraphYear] = useState(currentYear());
  const [graphMonthSel, setGraphMonthSel] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [settingsSub, setSettingsSub] = useState("theme");
  const [menuForm, setMenuForm] = useState({ name:"", price:"" });
  const [editMenuId, setEditMenuId] = useState(null);
  const [tplForm, setTplForm] = useState("");
  const [pricingSettings, setPricingSettings] = useState(DEFAULT_PRICING);
  const [showNailCalc, setShowNailCalc] = useState(false);

  const importRef = useRef();
  const photoRef  = useRef();

  // ── Supabase clients/kartes fetch ────────────────────────────
  const fetchClients = async () => {
    const { data, error } = await supabase.from("clients").select("*").eq("user_id", session.user.id).order("created_at");
    console.log("fetchClients data:", data, "error:", error);
    if (data) setClients(data);
  };
  const fetchKartes = async () => {
    const { data, error } = await supabase.from("kartes").select("*").eq("user_id", session.user.id).order("created_at");
    console.log("fetchKartes data:", data, "error:", error);
    if (data) setKartes(data.map(k => ({ ...k, clientId: k.client_id, menuId: k.menu_id, treatMemo: k.treat_memo, talkMemo: k.talk_memo })));
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from("salon_settings").select("*").eq("user_id", session.user.id).maybeSingle();
    if (data) {
      if (data.menus) setMenus(data.menus);
      if (data.templates) setTemplates(data.templates);
      if (data.payments) setPayments(data.payments);
      if (data.theme) { setThemeKey(data.theme); LS.set("sn4_theme", data.theme); }
      if (data.salon_name !== undefined) setSalonInfo({ name: data.salon_name || "", genre: data.genre || "" });
    }
  };

  const fetchPricingSettings = async () => {
    const { data, error } = await supabase.from("pricing_settings").select("*").eq("user_id", session.user.id).maybeSingle();
    if (error) { console.error("fetchPricingSettings error:", error); return; }
    if (data) setPricingSettings({ ...DEFAULT_PRICING, ...data });
    else await savePricingSettings(DEFAULT_PRICING); // 初回のみデフォルト値で1行作成
  };
  const savePricingSettings = async (patch) => {
    setPricingSettings(patch);
    const { error } = await supabase.from("pricing_settings").upsert(
      { user_id: session.user.id, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (error) { alert("料金設定の保存に失敗しました"); console.error("savePricingSettings error:", error); }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchClients(), fetchKartes(), fetchSettings(), fetchPricingSettings()]).then(() => setLoading(false));
  }, [session]);

  const saveC = c => { setClients(c); LS.set("sn4_clients", c); };
  const saveK = k => { setKartes(k); LS.set("sn4_kartes", k); };
  const saveSettings = async (patch) => {
    await supabase.from("salon_settings").upsert({ user_id: session.user.id, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  };
  const saveM = async m => { setMenus(m); await saveSettings({ menus: m }); };
  const saveT = async t => { setTemplates(t); await saveSettings({ templates: t }); };

  const fetchPending = async () => {
    setLoadingPending(true);
    const { data, error } = await supabase.from("pending_clients").select("*").eq("status","pending").order("created_at", { ascending: false });
    if (!error && data) setPending(data);
    setLoadingPending(false);
  };
  const approvePending = async (p) => {
    if (!confirm(`${p.name} さんを顧客登録しますか？`)) return;
    const id = genId();
    await supabase.from("clients").insert({ id, user_id: session.user.id, name: p.name, phone: p.phone||"", email: "", birthday: p.birthday||"", allergy: p.allergy||"", notes: "", memo: "" });
    await supabase.from("pending_clients").update({ status:"approved" }).eq("id", p.id);
    await fetchClients();
    setPending(pending.filter(x => x.id !== p.id));
    alert(`${p.name} さんを登録しました！`);
  };
  const rejectPending = async (p) => {
    if (!confirm(`${p.name} さんを削除しますか？`)) return;
    await supabase.from("pending_clients").update({ status:"rejected" }).eq("id", p.id);
    setPending(pending.filter(x => x.id !== p.id));
  };

  const fetchMembers = async () => {
    const { data } = await supabase.from("salon_members").select("*").order("created_at");
    if (data) setMembers(data);
  };
  const approveMember = async (id) => {
    await supabase.from("salon_members").update({ status:"active" }).eq("id", id);
    fetchMembers();
  };
  const removeMember = async (id) => {
    if (!confirm("このメンバーを削除しますか？")) return;
    await supabase.from("salon_members").delete().eq("id", id);
    fetchMembers();
  };
  const generateInvite = async () => {
    if (members.filter(m=>m.status==="active").length >= 5) { alert("メンバーは最大5人までです"); return; }
    setInviteLoading(true);
    const token = genId() + genId();
    await supabase.from("invitations").insert({ token, invited_by: session.user.id });
    setInviteUrl(`${window.location.origin}?invite=${token}`);
    setInviteLoading(false);
  };

  const savePayments = async p => { setPayments(p); await saveSettings({ payments: p }); };
  const getClient = id => clients.find(c => c.id === id);
  const getMenu   = id => menus.find(m => m.id === id);
  const lastVisit = id => kartes.filter(k => (k.clientId || k.client_id) === id).sort((a,b) => b.date.localeCompare(a.date))[0]?.date || null;
  const byDate    = ds => kartes.filter(k => k.date === ds);
  const todayMD   = () => { const d = new Date(); return `${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const isBirthday = (bday, ds) => { if (!bday) return false; return ds.slice(5) === bday.slice(5); };
  const birthdayClientsThisMonth = () => {
    const { y, m } = calYM; const mm = String(m+1).padStart(2,"0");
    return clients.filter(c => c.birthday && c.birthday.slice(5,7) === mm);
  };

  const openNewClient  = () => { setEditClientId(null); setCf(EMPTY_C); setClientDirty(false); setShowClientModal(true); };
  const openEditClient = c  => { setEditClientId(c.id); setCf({ name:c.name,phone:c.phone,email:c.email,birthday:c.birthday||"",allergy:c.allergy,notes:c.notes,memo:c.memo }); setClientDirty(false); setShowClientModal(true); };
  const formatPhone = (phone) => {
    const d = phone.replace(/[^\d]/g, "");
    if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
    return phone;
  };
  const submitClient = async () => {
    console.log("submitClient called", cf);
    if (!cf.name.trim()) { console.log("name empty"); return; }
    if (!cf.phone.trim()) { alert("電話番号は必須です"); return; }
    if (!editClientId && clients.length >= 10 && subStatus !== "active") {
      setShowClientModal(false);
      onShowPayment();
      return;
    }
    const formatted = { ...cf, phone: formatPhone(cf.phone) };
    if (editClientId) {
      const { error } = await supabase.from("clients").update({ name:formatted.name, phone:formatted.phone, email:formatted.email, birthday:formatted.birthday, allergy:formatted.allergy, notes:formatted.notes, memo:formatted.memo }).eq("id", editClientId);
      console.log("update error:", error);
    } else {
      const id = genId();
      console.log("inserting with id:", id, "user_id:", session.user.id);
      const { error } = await supabase.from("clients").insert({ id, user_id: session.user.id, ...formatted });
      console.log("insert error:", error);
    }
    await fetchClients();
    setShowClientModal(false);
  };
  const deleteClient = async id => {
    if (!confirm("この顧客とカルテ履歴を全て削除しますか？")) return;
    await supabase.from("kartes").delete().eq("client_id", id);
    await supabase.from("clients").delete().eq("id", id);
    await fetchClients();
    await fetchKartes();
    if (detailId===id) setDetailId(null);
  };

  const openNewKarte = (preId="") => {
    setEditKarteId(null);
    const preC = preId ? getClient(preId) : null;
    setPickerQ(preC ? preC.name : ""); setPickerOpen(false);
    setKf({ clientId:preId, date:calSel, price:"", menuId:"", treatMemo:"", talkMemo:"", photo:"" });
    setKarteDirty(false); setShowKarteModal(true);
  };
  const openEditKarte = k => {
    setEditKarteId(k.id);
    const c = getClient(k.clientId);
    setPickerQ(c ? c.name : ""); setPickerOpen(false);
    setKf({ clientId:k.clientId, date:k.date, menuId:k.menuId||"", price:k.price, payment:k.payment||"", treatMemo:k.treatMemo, talkMemo:k.talkMemo, photo:k.photo||"" });
    setKarteDirty(false); setShowKarteModal(true);
  };
  const submitKarte = async () => {
    if (!kf.clientId || !kf.date) return;
    const record = { user_id: session.user.id, client_id: kf.clientId, date: kf.date, menu_id: kf.menuId||null, price: kf.price, payment: kf.payment||null, treat_memo: kf.treatMemo, talk_memo: kf.talkMemo, photo: kf.photo||null };
    const { error } = editKarteId
      ? await supabase.from("kartes").update(record).eq("id", editKarteId)
      : await supabase.from("kartes").insert({ id: genId(), ...record });
    if (error) { alert("カルテの保存に失敗しました。通信状態を確認してもう一度お試しください。"); console.error("submitKarte error:", error); return; }
    await fetchKartes();
    setShowKarteModal(false);
  };
  const deleteKarte = async id => {
    if (!confirm("このカルテを削除しますか？")) return;
    await supabase.from("kartes").delete().eq("id", id);
    await fetchKartes();
  };
  const handlePhoto = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = ev => setKf(p => ({ ...p, photo:ev.target.result })); r.readAsDataURL(f);
  };

  const addMenu = () => {
    if (!menuForm.name.trim()) return;
    if (editMenuId) { saveM(menus.map(m => m.id===editMenuId ? { ...m, ...menuForm } : m)); setEditMenuId(null); }
    else saveM([...menus, { id:genId(), name:menuForm.name, price:menuForm.price }]);
    setMenuForm({ name:"", price:"" });
  };
  const deleteMenu = id => saveM(menus.filter(m => m.id!==id));
  const addTpl = () => { if (!tplForm.trim()) return; saveT([...templates, { id:genId(), text:tplForm }]); setTplForm(""); };
  const deleteTpl = id => saveT(templates.filter(t => t.id!==id));

  const doExport = () => {
    const data = JSON.stringify({ clients, kartes, menus, templates, exportedAt:new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`salon-note-backup-${todayStr()}.json`; a.click();
    URL.revokeObjectURL(url); LS.set("sn4_last_export", new Date().toISOString()); setShowBackupAlert(false);
  };
  const doImport = e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = async ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (!d.clients || !d.kartes) { alert("ファイルの形式が正しくありません"); return; }
        if (!confirm(`バックアップから復元しますか？\n顧客${d.clients.length}件 / カルテ${d.kartes.length}件\n※現在のデータは上書きされます`)) return;
        // Supabaseに保存
        for (const c of d.clients) {
          await supabase.from("clients").upsert({ ...c, user_id: session.user.id });
        }
        for (const k of d.kartes) {
          await supabase.from("kartes").upsert({ id:k.id, user_id: session.user.id, client_id:k.clientId, date:k.date, menu_id:k.menuId||null, price:k.price, payment:k.payment||null, treat_memo:k.treatMemo, talk_memo:k.talkMemo, photo:k.photo||null });
        }
        if (d.menus) saveM(d.menus);
        if (d.templates) saveT(d.templates);
        await fetchClients();
        await fetchKartes();
        alert("復元しました！");
      } catch(err) { alert("読み込みに失敗しました: " + err.message); }
    };
    r.readAsText(file); e.target.value="";
  };

  const { y:cy, m:cm } = calYM;
  const firstDay    = new Date(cy, cm, 1).getDay();
  const daysInMonth = new Date(cy, cm+1, 0).getDate();
  const calDs = d => `${cy}-${String(cm+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const WDAYS  = ["日","月","火","水","木","金","土"];
  const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

  const yearKartes  = kartes.filter(k => k.date.startsWith(String(cmsYear))).sort((a,b) => a.date.localeCompare(b.date));
  const totalAmt    = yearKartes.reduce((s,k) => s+(parseInt(k.price)||0), 0);
  const yearCsvText = [`${cmsYear}年 売上記録`, `日付\tお客様名\t金額`, ...yearKartes.map(k => { const c=getClient(k.clientId); return `${k.date}\t${c?.name||"不明"}\t¥${parseInt(k.price||0).toLocaleString()}`; }), ``, `合計: ¥${totalAmt.toLocaleString()}（${yearKartes.length}件）`].join("\n");
  const doCopy = (text, id) => { navigator.clipboard.writeText(text).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 2500); }); };

  const monthlyData = Array.from({ length:12 }, (_, i) => {
    const mm = String(i+1).padStart(2,"0");
    const ks = kartes.filter(k => k.date.startsWith(`${graphYear}-${mm}`));
    return { month:`${i+1}月`, amt:ks.reduce((s,k) => s+(parseInt(k.price)||0), 0), count:ks.length };
  });
  const maxAmt = Math.max(...monthlyData.map(d => d.amt), 1);
  const menuBreakdown = (ks) => {
    const map = {};
    ks.forEach(k => { const name = k.menuId && getMenu(k.menuId) ? getMenu(k.menuId).name : (k.treatMemo ? k.treatMemo.slice(0,10) : "その他"); map[name] = (map[name]||0) + (parseInt(k.price)||0); });
    const total = Object.values(map).reduce((s,v)=>s+v,0);
    return Object.entries(map).map(([name,amt]) => ({ name, amt, pct: total>0 ? amt/total : 0 })).sort((a,b)=>b.amt-a.amt);
  };
  const PIE_COLORS = ["#c8937a","#d4b08a","#a0897a","#7a6a5a","#b09a92","#e8c8a8","#8a7060","#c0a080"];
  const PieChart = ({ data, size=120 }) => {
    if (!data.length) return null;
    const cx = size/2, pcy = size/2, r = size/2 - 6, ir = r * 0.55;
    if (data.length === 1) return <svg width={size} height={size} style={{ display:"block" }}><circle cx={cx} cy={pcy} r={r} fill={PIE_COLORS[0]} /><circle cx={cx} cy={pcy} r={ir} fill="white" opacity="0.85" /></svg>;
    let cumAngle = -Math.PI/2;
    return (
      <svg width={size} height={size} style={{ display:"block" }}>
        {data.map((d,i) => {
          const startAngle = cumAngle; const sweep = Math.max(d.pct * 2 * Math.PI, 0.001); cumAngle += sweep;
          if (d.pct < 0.005) return null;
          const x1=cx+r*Math.cos(startAngle), y1=pcy+r*Math.sin(startAngle), x2=cx+r*Math.cos(cumAngle), y2=pcy+r*Math.sin(cumAngle);
          const ix1=cx+ir*Math.cos(cumAngle), iy1=pcy+ir*Math.sin(cumAngle), ix2=cx+ir*Math.cos(startAngle), iy2=pcy+ir*Math.sin(startAngle);
          const largeArc = sweep > Math.PI ? 1 : 0;
          return <path key={i} d={`M${x1},${y1} A${r},${r},0,${largeArc},1,${x2},${y2} L${ix1},${iy1} A${ir},${ir},0,${largeArc},0,${ix2},${iy2} Z`} fill={PIE_COLORS[i%PIE_COLORS.length]} stroke="white" strokeWidth="1.5" />;
        })}
      </svg>
    );
  };

  const filteredClients = clients.filter(c => c.name.includes(clientSearch) || (c.phone||"").includes(clientSearch));
  const pickerClients   = clients.filter(c => c.name.includes(pickerQ) || (c.phone||"").includes(pickerQ));

  const base = { width:"100%", padding:"10px 12px", border:`1px solid ${T.border}`, borderRadius:9, fontSize:14, background:T.bg, color:T.text, outline:"none", boxSizing:"border-box", fontFamily:"inherit", display:"block" };
  const Lbl  = ({ t }) => <div style={{ fontSize:11, color:T.sub, letterSpacing:"0.1em", marginBottom:5, fontFamily:"'Cormorant Garamond',serif" }}>{t}</div>;
  const Btn  = ({ onClick, children, color, small, full, disabled }) => (
    <button onClick={onClick} disabled={disabled} style={{ background:disabled?T.muted:(color||T.accent), color:"#fff", border:"none", borderRadius:9, padding:small?"7px 13px":"12px 20px", cursor:disabled?"default":"pointer", fontSize:small?12:14, fontFamily:"'Cormorant Garamond',serif", letterSpacing:"0.06em", whiteSpace:"nowrap", flexShrink:0, width:full?"100%":undefined }}>{children}</button>
  );
  const Card = ({ children, style, onClick }) => (
    <div onClick={onClick} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:13, padding:"14px 16px", marginBottom:10, boxShadow:"0 1px 4px rgba(0,0,0,0.06)", cursor:onClick?"pointer":"default", ...style }}>{children}</div>
  );

  const SvgIcon = ({ type, color }) => {
    const s = { width:20, height:20, display:"inline-block", flexShrink:0, verticalAlign:"middle" };
    if (type==="clients")  return <svg style={s} viewBox="0 0 22 22" fill="none"><circle cx="8" cy="7" r="3" fill={color}/><path d="M2 18c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none"/><circle cx="15" cy="7" r="2.5" fill={color} opacity="0.5"/><path d="M19 18c0-2.8-1.8-5.1-4-5.8" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/></svg>;
    if (type==="calendar") return <svg style={s} viewBox="0 0 22 22" fill="none"><rect x="2" y="4" width="18" height="16" rx="3" stroke={color} strokeWidth="1.5" fill="none"/><path d="M7 2v4M15 2v4M2 9h18" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><circle cx="7" cy="14" r="1.2" fill={color}/><circle cx="11" cy="14" r="1.2" fill={color}/><circle cx="15" cy="14" r="1.2" fill={color}/></svg>;
    if (type==="pending")  return <svg style={s} viewBox="0 0 22 22" fill="none"><path d="M3 4h16l-2 9H5L3 4z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none"/><path d="M3 4H1M5 13l-1 4h14l-1-4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="20" r="1.2" fill={color}/><circle cx="14" cy="20" r="1.2" fill={color}/><circle cx="9" cy="8" r="0.8" fill={color}/><circle cx="13" cy="8" r="0.8" fill={color}/><path d="M9 10.5h4" stroke={color} strokeWidth="1.2" strokeLinecap="round"/></svg>;
    if (type==="cms")      return <svg style={s} viewBox="0 0 22 22" fill="none"><rect x="3" y="2" width="14" height="18" rx="2" stroke={color} strokeWidth="1.5" fill="none"/><path d="M7 7h8M7 11h8M7 15h5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><path d="M17 14l4 4-1.5 1.5L15.5 15.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    if (type==="graph")    return <svg style={s} viewBox="0 0 22 22" fill="none"><path d="M2 20h18" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><rect x="4" y="12" width="3" height="8" rx="1" fill={color} opacity="0.5"/><rect x="9.5" y="7" width="3" height="13" rx="1" fill={color}/><rect x="15" y="4" width="3" height="16" rx="1" fill={color} opacity="0.7"/></svg>;
    if (type==="settings") return <svg style={s} viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="3" stroke={color} strokeWidth="1.5" fill="none"/><path d="M11 2v2M11 18v2M2 11h2M18 11h2M4.9 4.9l1.4 1.4M15.7 15.7l1.4 1.4M4.9 17.1l1.4-1.4M15.7 6.3l1.4-1.4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></svg>;
    return null;
  };

  const NAV = [
    { key:"clients",  label:"顧客",     shortLabel:"顧客" },
    { key:"calendar", label:"カレンダー", shortLabel:"カレンダー" },
    { key:"pending",  label:"承認待ち",  shortLabel:"承認待ち" },
    { key:"cms",      label:"出力",     shortLabel:"出力" },
    { key:"graph",    label:"売上",     shortLabel:"売上" },
    { key:"settings", label:"設定",     shortLabel:"設定" },
  ];

  useEffect(() => { if (tab === "pending") fetchPending(); }, [tab]);
  useEffect(() => { if (tab === "settings" && settingsSub === "members") fetchMembers(); }, [tab, settingsSub]);
  useEffect(() => {
    const last = LS.get("sn4_last_export", null);
    if (!last) { setShowBackupAlert(true); return; }
    const days = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
    if (days >= 30) setShowBackupAlert(true);
  }, []);

  const closeClientModal = () => { if (clientDirty && !confirm("変更を破棄しますか？")) return; setShowClientModal(false); setClientDirty(false); };
  const closeKarteModal  = () => { if (karteDirty  && !confirm("変更を破棄しますか？")) return; setShowKarteModal(false);  setKarteDirty(false); };
  const REGISTER_URL = typeof window !== "undefined" ? window.location.origin + "/register" : "";

  // ── Feedback ──────────────────────────────────────────────────
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackList, setFeedbackList] = useState([]);
  const [showFeedbackList, setShowFeedbackList] = useState(false);

  const submitFeedback = async () => {
    if (!feedbackText.trim()) return;
    setFeedbackSending(true);
    const { error } = await supabase.from("feedback").insert({ message: feedbackText.trim() });
    if (!error) { setFeedbackSent(true); setFeedbackText(""); setTimeout(() => setFeedbackSent(false), 3000); }
    setFeedbackSending(false);
  };
  const fetchFeedback = async () => {
    const { data } = await supabase.from("feedback").select("*").order("created_at", { ascending: false });
    if (data) setFeedbackList(data);
    setShowFeedbackList(true);
  };
  return (
    <div style={{ minHeight:"100vh", fontFamily:"'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif", background:T.bg, color:T.text }}>
      <div style={{ display:"flex", minHeight:"100vh", maxWidth:1100, margin:"0 auto" }}>

        {/* PC Sidebar */}
        <div className="pc-sidebar" style={{ width:220, flexShrink:0, background:T.card, borderRight:`1px solid ${T.border}`, padding:"32px 0", position:"sticky", top:0, height:"100vh", overflowY:"auto" }}>
          <div style={{ padding:"0 24px 32px" }}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:T.accent, letterSpacing:"0.15em" }}>✦ SALON</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:T.accent, letterSpacing:"0.15em", marginTop:-4 }}>NOTE</div>
            {salonInfo.name && <div style={{ fontSize:11, color:T.sub, marginTop:6, fontFamily:"'Cormorant Garamond',serif" }}>by {salonInfo.name}</div>}
            {salonInfo.genre && <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>✦ {salonInfo.genre}</div>}
          </div>
          {NAV.map(n => (
            <div key={n.key} onClick={() => setTab(n.key)} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 24px", cursor:"pointer", background:tab===n.key?T.accent+"18":"transparent", borderLeft:tab===n.key?`3px solid ${T.accent}`:"3px solid transparent", fontSize:14, fontFamily:"'Cormorant Garamond',serif", letterSpacing:"0.06em" }}>
              <span style={{ flexShrink:0, display:"flex", alignItems:"center" }}><SvgIcon type={n.key} color={tab===n.key?T.accent:T.muted} /></span>
              <span style={{ color:tab===n.key?T.accent:T.muted }}>{n.label}</span>
            </div>
          ))}
          <div style={{ padding:"20px 24px 0", marginTop:12, borderTop:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11, color:T.muted, marginBottom:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{session.user.email}</div>
            <button onClick={() => supabase.auth.signOut()} style={{ fontSize:11, color:T.muted, background:"none", border:`1px solid ${T.border}`, borderRadius:7, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit" }}>ログアウト</button>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
          {/* Mobile header */}
          <div className="mobile-header" style={{ background:T.card, borderBottom:`1px solid ${T.border}`, padding:"16px 20px 10px", position:"sticky", top:0, zIndex:80 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:21, color:T.accent, letterSpacing:"0.15em" }}>✦ SALON NOTE</div>
                {salonInfo.name && <div style={{ fontSize:11, color:T.sub, marginTop:2, fontFamily:"'Cormorant Garamond',serif" }}>by {salonInfo.name}{salonInfo.genre ? `　✦ ${salonInfo.genre}` : ""}</div>}
                {!salonInfo.name && <div style={{ fontSize:10, color:T.muted, marginTop:1 }}>サロン管理アプリ</div>}
              </div>
              <button onClick={() => supabase.auth.signOut()} style={{ fontSize:11, color:T.muted, background:"none", border:`1px solid ${T.border}`, borderRadius:7, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>ログアウト</button>
            </div>
          </div>
          {/* PC page title */}
          <div className="pc-title" style={{ display:"none", padding:"28px 40px 18px", borderBottom:`1px solid ${T.border}`, background:T.card }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <SvgIcon type={tab} color={T.accent} />
              <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:T.text, letterSpacing:"0.08em" }}>{NAV.find(n=>n.key===tab)?.label}</span>
            </div>
          </div>

          <div className="content-area">

            {/* 顧客一覧 */}
            {tab==="clients" && <>
              {clients.length >= 10 && subStatus !== "active" && (
                <div onClick={onShowPayment} style={{ background:"#c8937a18", border:"1px solid #c8937a40", borderRadius:12, padding:"12px 16px", marginBottom:12, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:13, color:"#c8937a", fontWeight:"bold" }}>🌷 顧客数が10人に達しました</div>
                    <div style={{ fontSize:11, color:"#b09a92", marginTop:2 }}>プレミアムプランで無制限に登録できます（月額390円）</div>
                  </div>
                  <div style={{ fontSize:12, color:"#c8937a", flexShrink:0, marginLeft:8 }}>詳細 ›</div>
                </div>
              )}
              <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center" }}>
                <IMEInput value={clientSearch} onChange={setClientSearch} placeholder="名前・電話番号で検索" style={{ ...base, flex:1 }} />
                <Btn onClick={openNewClient}>＋ 追加</Btn>
              </div>
              {filteredClients.length===0 && <div style={{ textAlign:"center", color:T.muted, fontSize:13, padding:"40px 0" }}>顧客データがありません</div>}
              {filteredClients.map(c => {
                const lv = lastVisit(c.id); const isOpen = detailId===c.id;
                const clientKartes = kartes.filter(k => k.clientId===c.id).sort((a,b) => b.date.localeCompare(a.date));
                const isBday = c.birthday && c.birthday.slice(5)===todayMD();
                return (
                  <Card key={c.id} onClick={() => setDetailId(isOpen?null:c.id)}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ fontSize:15, fontWeight:"bold", color:T.text }}>{c.name}</span>
                          {isBday && <span style={{ fontSize:12 }}>🎂 今日誕生日！</span>}
                        </div>
                        {c.phone && <div style={{ fontSize:12, color:T.muted, marginTop:2 }}>{c.phone}{c.email?`  ${c.email}`:""}</div>}
                        {c.allergy && <div style={{ fontSize:11, color:"#d06050", marginTop:3 }}>⚠ {c.allergy}</div>}
                        {lv ? <div style={{ fontSize:11, color:T.accent, marginTop:3 }}>前回 {lv} ご来店</div> : <div style={{ fontSize:11, color:T.muted, marginTop:3 }}>来店記録なし</div>}
                      </div>
                      <div style={{ display:"flex", gap:5, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                        <Btn small color={T.sub} onClick={() => openEditClient(c)}>編集</Btn>
                        <Btn small color={T.danger} onClick={() => deleteClient(c.id)}>削除</Btn>
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ marginTop:12, borderTop:`1px solid ${T.border}`, paddingTop:12 }}>
                        {c.birthday && <div style={{ fontSize:13, marginBottom:5 }}><span style={{ color:T.sub }}>誕生日: </span>{c.birthday}</div>}
                        {c.notes && <div style={{ fontSize:13, marginBottom:5 }}><span style={{ color:T.sub }}>注意事項: </span>{c.notes}</div>}
                        {c.memo  && <div style={{ fontSize:13, marginBottom:10 }}><span style={{ color:T.sub }}>特徴メモ: </span>{c.memo}</div>}
                        <div style={{ fontSize:11, color:T.sub, letterSpacing:"0.08em", fontFamily:"'Cormorant Garamond',serif", marginBottom:8 }}>来店カルテ履歴</div>
                        {clientKartes.length===0 && <div style={{ fontSize:12, color:T.muted, marginBottom:8 }}>来店記録なし</div>}
                        {clientKartes.map(k => (
                          <div key={k.id} style={{ background:T.bg, borderRadius:8, padding:"9px 12px", marginBottom:6 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:13, fontWeight:"bold" }}>{k.date} — ¥{k.price||"−"}{k.payment ? <span style={{ marginLeft:6, fontSize:11, background:T.accent+"22", color:T.accent, borderRadius:20, padding:"1px 7px" }}>{k.payment}</span> : null}</div>
                                {k.menuId && getMenu(k.menuId) && <div style={{ fontSize:12, color:T.accent, marginTop:1 }}>📋 {getMenu(k.menuId).name}</div>}
                                {k.treatMemo && <div style={{ fontSize:12, color:T.muted, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>施術: {k.treatMemo}</div>}
                                {k.photo && <button onClick={e => { e.stopPropagation(); setLightbox(k.photo); }} style={{ marginTop:4, background:"none", border:`1px solid ${T.border}`, borderRadius:7, padding:"3px 9px", fontSize:11, color:T.sub, cursor:"pointer" }}>📷 写真を見る</button>}
                              </div>
                              <div style={{ display:"flex", gap:5, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                                <Btn small color={T.sub} onClick={() => openEditKarte(k)}>編集</Btn>
                                <Btn small color={T.danger} onClick={() => deleteKarte(k.id)}>削除</Btn>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div style={{ marginTop:6 }} onClick={e=>e.stopPropagation()}>
                          <Btn small onClick={() => openNewKarte(c.id)}>＋ カルテを追加</Btn>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </>}

            {/* カレンダー */}
            {tab==="calendar" && <>
              <Card style={{ padding:"14px 14px 12px" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <button onClick={() => setCalYM(p => { const d=new Date(p.y,p.m-1); return { y:d.getFullYear(),m:d.getMonth() }; })} style={{ background:"none", border:"none", fontSize:22, color:T.accent, cursor:"pointer", padding:"0 10px", lineHeight:1 }}>‹</button>
                  <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, letterSpacing:"0.1em" }}>{cy}年 {MONTHS[cm]}</span>
                  <button onClick={() => setCalYM(p => { const d=new Date(p.y,p.m+1); return { y:d.getFullYear(),m:d.getMonth() }; })} style={{ background:"none", border:"none", fontSize:22, color:T.accent, cursor:"pointer", padding:"0 10px", lineHeight:1 }}>›</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:4 }}>
                  {WDAYS.map((w,i) => <div key={w} style={{ textAlign:"center", fontSize:11, color:i===0?"#d06050":i===6?"#5070c0":T.muted, padding:"3px 0" }}>{w}</div>)}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
                  {Array.from({ length:firstDay }, (_,i) => <div key={`e${i}`} />)}
                  {Array.from({ length:daysInMonth }, (_,i) => {
                    const d=i+1, ds=calDs(d);
                    const hasK = kartes.some(k => k.date===ds);
                    const hasBday = clients.some(c => isBirthday(c.birthday, ds));
                    const isSel=calSel===ds, isToday=ds===todayStr();
                    return (
                      <div key={d} onClick={() => setCalSel(ds)} style={{ textAlign:"center", padding:"5px 2px 2px", borderRadius:7, cursor:"pointer", background:isSel?T.accent:isToday?T.accent+"22":"transparent", color:isSel?"#fff":T.text, fontSize:13, fontWeight:isToday?"bold":"normal", userSelect:"none" }}>
                        {d}
                        <div style={{ display:"flex", justifyContent:"center", gap:2, marginTop:1 }}>
                          {hasK  && <div style={{ width:4, height:4, borderRadius:"50%", background:isSel?"#fff":T.accent }} />}
                          {hasBday && <div style={{ width:4, height:4, borderRadius:"50%", background:isSel?"#fff":"#e07060" }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display:"flex", gap:12, marginTop:10, fontSize:11, color:T.muted }}>
                  <span><span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:T.accent, marginRight:4 }} />カルテあり</span>
                  <span><span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:"#e07060", marginRight:4 }} />誕生日</span>
                </div>
              </Card>
              {birthdayClientsThisMonth().length>0 && (
                <Card style={{ background:T.accent+"12", border:`1px solid ${T.accent}40` }}>
                  <div style={{ fontSize:12, color:T.accent, fontFamily:"'Cormorant Garamond',serif", marginBottom:8 }}>🎂 今月の誕生日</div>
                  {birthdayClientsThisMonth().map(c => <div key={c.id} style={{ fontSize:13, marginBottom:4 }}>{c.birthday.slice(5).replace("-","/")}　{c.name}</div>)}
                </Card>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", margin:"14px 0 10px" }}>
                <span style={{ fontSize:13, color:T.sub, fontFamily:"'Cormorant Garamond',serif" }}>{calSel}（{byDate(calSel).length}件）</span>
                <Btn small onClick={() => openNewKarte()}>＋ カルテ追加</Btn>
              </div>
              {byDate(calSel).length===0
                ? <div style={{ textAlign:"center", color:T.muted, fontSize:13, padding:"20px 0" }}>この日のカルテはありません</div>
                : byDate(calSel).map(k => {
                    const c = getClient(k.clientId); const isBday = c && isBirthday(c?.birthday, calSel);
                    return (
                      <Card key={k.id}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:15, fontWeight:"bold" }}>{c?.name||"不明"} {isBday?"🎂":""}</div>
                            {k.menuId && getMenu(k.menuId) && <div style={{ fontSize:12, color:T.accent, marginTop:2 }}>📋 {getMenu(k.menuId).name}</div>}
                            <div style={{ fontSize:13, color:T.muted }}>¥{k.price||"−"}{k.payment ? <span style={{ marginLeft:8, fontSize:11, background:T.accent+"22", color:T.accent, borderRadius:20, padding:"1px 8px" }}>{k.payment}</span> : null}</div>
                            {k.treatMemo && <div style={{ fontSize:12, color:T.muted, marginTop:4 }}>施術: {k.treatMemo}</div>}
                            {k.talkMemo  && <div style={{ fontSize:12, color:T.muted }}>会話: {k.talkMemo}</div>}
                            {k.photo && <button onClick={() => setLightbox(k.photo)} style={{ marginTop:6, background:"none", border:`1px solid ${T.border}`, borderRadius:7, padding:"4px 10px", fontSize:11, color:T.sub, cursor:"pointer" }}>📷 写真を見る</button>}
                          </div>
                          <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                            <Btn small color={T.sub} onClick={() => openEditKarte(k)}>編集</Btn>
                            <Btn small color={T.danger} onClick={() => deleteKarte(k.id)}>削除</Btn>
                          </div>
                        </div>
                      </Card>
                    );
                  })
              }
            </>}

            {/* 承認待ち */}
            {tab==="pending" && <>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ fontSize:13, color:T.sub, fontFamily:"'Cormorant Garamond',serif" }}>お客様登録フォームの送信一覧</div>
                <Btn small onClick={fetchPending}>🔄 更新</Btn>
              </div>
              <Card style={{ marginBottom:16, background:T.accent+"10", border:`1px solid ${T.accent}40` }}>
                <div style={{ fontSize:14, fontWeight:"bold", color:T.text, marginBottom:8 }}>📱 お客様用QRコード</div>
                <div style={{ fontSize:12, color:T.muted, marginBottom:12, lineHeight:1.7 }}>このQRコードをサロンに掲示してください。<br/>お客様がスキャンすると登録フォームが開きます。</div>
                <div style={{ background:"#fff", padding:16, borderRadius:12, textAlign:"center", marginBottom:10 }}>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(REGISTER_URL)}`} alt="QR Code" style={{ width:200, height:200, display:"block", margin:"0 auto" }} />
                  <div style={{ fontSize:11, color:T.muted, marginTop:8 }}>{REGISTER_URL}</div>
                </div>
                <Btn full color={T.sub} onClick={() => window.print()}>🖨️ 印刷する</Btn>
              </Card>
              {loadingPending && <div style={{ textAlign:"center", color:T.muted, fontSize:13, padding:"20px 0" }}>読み込み中...</div>}
              {!loadingPending && pending.length === 0 && <div style={{ textAlign:"center", color:T.muted, fontSize:13, padding:"30px 0" }}>承認待ちのお客様はいません</div>}
              {pending.map(p => (
                <Card key={p.id}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:16, fontWeight:"bold", color:T.text }}>{p.name}</div>
                      <div style={{ fontSize:12, color:T.muted, marginTop:2 }}>{p.phone}</div>
                      <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{new Date(p.created_at).toLocaleString("ja-JP")} 送信</div>
                    </div>
                  </div>
                  {p.birthday && <div style={{ fontSize:13, marginBottom:4 }}><span style={{ color:T.sub }}>生年月日: </span>{p.birthday}</div>}
                  {p.address  && <div style={{ fontSize:13, marginBottom:4 }}><span style={{ color:T.sub }}>住所: </span>{p.address}</div>}
                  {p.allergy  && <div style={{ fontSize:13, marginBottom:4, color:"#d06050" }}>⚠ {p.allergy}</div>}
                  <div style={{ display:"flex", gap:6, marginTop:4 }}>
                    {[["agree_service","利用規約"],["agree_privacy","プライバシー"],["agree_cancel","キャンセル"]].map(([k,l]) => (
                      <span key={k} style={{ fontSize:11, background:p[k]?T.accent+"22":"#ff000020", color:p[k]?T.accent:"#cc7070", borderRadius:20, padding:"2px 8px" }}>{p[k]?"✓ ":"✗ "}{l}</span>
                    ))}
                  </div>
                  <div style={{ display:"flex", gap:8, marginTop:12 }}>
                    <button onClick={() => approvePending(p)} style={{ flex:1, padding:"11px 12px", background:T.accent, color:"#fff", border:"none", borderRadius:9, cursor:"pointer", fontSize:14, fontFamily:"'Cormorant Garamond',serif", letterSpacing:"0.06em" }}>✓ 承認して登録</button>
                    <button onClick={() => rejectPending(p)} style={{ flexShrink:0, padding:"11px 14px", background:T.danger, color:"#fff", border:"none", borderRadius:9, cursor:"pointer", fontSize:14, fontFamily:"'Cormorant Garamond',serif" }}>削除</button>
                  </div>
                </Card>
              ))}
            </>}

            {/* 出力 */}
            {tab==="cms" && <>
              <div style={{ fontSize:13, color:T.sub, fontFamily:"'Cormorant Garamond',serif", letterSpacing:"0.08em", marginBottom:8 }}>年間売上（確定申告用）</div>
              <Card style={{ padding:"12px 16px", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <button onClick={() => setCmsYear(y=>y-1)} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:7, width:32, height:32, cursor:"pointer", color:T.accent, fontSize:16, lineHeight:"30px", textAlign:"center" }}>‹</button>
                  <span style={{ fontSize:18, fontFamily:"'Cormorant Garamond',serif", minWidth:64, textAlign:"center" }}>{cmsYear}年</span>
                  <button onClick={() => setCmsYear(y=>y+1)} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:7, width:32, height:32, cursor:"pointer", color:T.accent, fontSize:16, lineHeight:"30px", textAlign:"center" }}>›</button>
                </div>
              </Card>
              <div style={{ display:"flex", gap:10, marginBottom:12 }}>
                <Card style={{ flex:1, padding:"12px 14px", marginBottom:0 }}><div style={{ fontSize:11, color:T.sub, fontFamily:"'Cormorant Garamond',serif" }}>件数</div><div style={{ fontSize:22, fontWeight:"bold", color:T.accent, marginTop:2 }}>{yearKartes.length}<span style={{ fontSize:13, color:T.muted, marginLeft:2 }}>件</span></div></Card>
                <Card style={{ flex:1, padding:"12px 14px", marginBottom:0 }}><div style={{ fontSize:11, color:T.sub, fontFamily:"'Cormorant Garamond',serif" }}>合計金額</div><div style={{ fontSize:22, fontWeight:"bold", color:T.accent, marginTop:2 }}>¥{totalAmt.toLocaleString()}</div></Card>
              </div>
              {yearKartes.length>0 && <div style={{ marginBottom:12 }}><Btn full onClick={() => doCopy(yearCsvText,"year")}>{copiedId==="year"?"✓ コピーしました！":"📋 年間データをコピー（タブ区切り）"}</Btn></div>}
              {yearKartes.length===0
                ? <div style={{ textAlign:"center", color:T.muted, fontSize:13, padding:"20px 0" }}>{cmsYear}年のカルテはありません</div>
                : <Card style={{ padding:0, overflow:"hidden" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr 0.9fr", background:T.accent+"18", padding:"9px 14px", borderBottom:`1px solid ${T.border}` }}>
                      {["日付","お客様名","金額"].map((h,i) => <div key={h} style={{ fontSize:11, color:T.sub, fontFamily:"'Cormorant Garamond',serif", textAlign:i===2?"right":"left" }}>{h}</div>)}
                    </div>
                    {yearKartes.map((k,i) => { const c=getClient(k.clientId); return (
                      <div key={k.id} style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr 0.9fr", padding:"9px 14px", borderBottom:i<yearKartes.length-1?`1px solid ${T.border}`:"none", background:i%2===0?"transparent":T.accent+"08" }}>
                        <div style={{ fontSize:13 }}>{k.date}</div>
                        <div style={{ fontSize:13 }}>{c?.name||"不明"}</div>
                        <div style={{ fontSize:13, textAlign:"right" }}>¥{parseInt(k.price||0).toLocaleString()}</div>
                      </div>
                    ); })}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr 0.9fr", padding:"10px 14px", borderTop:`2px solid ${T.border}`, background:T.accent+"18" }}>
                      <div style={{ fontSize:13, fontWeight:"bold", gridColumn:"1/3" }}>合計</div>
                      <div style={{ fontSize:13, fontWeight:"bold", color:T.accent, textAlign:"right" }}>¥{totalAmt.toLocaleString()}</div>
                    </div>
                  </Card>
              }
            </>}

            {/* 売上グラフ */}
            {tab==="graph" && <>
              <Card style={{ padding:"12px 16px", marginBottom:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  {graphMonthSel !== null && <button onClick={() => setGraphMonthSel(null)} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:7, padding:"4px 10px", cursor:"pointer", color:T.accent, fontSize:12 }}>← 年間</button>}
                  <button onClick={() => setGraphYear(y=>y-1)} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:7, width:32, height:32, cursor:"pointer", color:T.accent, fontSize:16, lineHeight:"30px", textAlign:"center" }}>‹</button>
                  <span style={{ fontSize:18, fontFamily:"'Cormorant Garamond',serif", minWidth:100, textAlign:"center" }}>{graphYear}年{graphMonthSel !== null ? `${graphMonthSel+1}月` : ""}</span>
                  <button onClick={() => setGraphYear(y=>y+1)} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:7, width:32, height:32, cursor:"pointer", color:T.accent, fontSize:16, lineHeight:"30px", textAlign:"center" }}>›</button>
                </div>
              </Card>
              {graphMonthSel === null ? <>
                <div style={{ display:"flex", gap:10, marginBottom:16 }}>
                  <Card style={{ flex:1, padding:"12px 14px", marginBottom:0 }}><div style={{ fontSize:11, color:T.sub, fontFamily:"'Cormorant Garamond',serif" }}>年間売上</div><div style={{ fontSize:20, fontWeight:"bold", color:T.accent, marginTop:2 }}>¥{monthlyData.reduce((s,d)=>s+d.amt,0).toLocaleString()}</div></Card>
                  <Card style={{ flex:1, padding:"12px 14px", marginBottom:0 }}><div style={{ fontSize:11, color:T.sub, fontFamily:"'Cormorant Garamond',serif" }}>年間件数</div><div style={{ fontSize:20, fontWeight:"bold", color:T.accent, marginTop:2 }}>{monthlyData.reduce((s,d)=>s+d.count,0)}<span style={{ fontSize:13, color:T.muted, marginLeft:2 }}>件</span></div></Card>
                </div>
                {(() => { const yk = kartes.filter(k=>k.date.startsWith(String(graphYear))); const bd = menuBreakdown(yk); return bd.length > 0 ? (
                  <Card style={{ marginBottom:16 }}>
                    <div style={{ fontSize:12, color:T.sub, marginBottom:14, fontFamily:"'Cormorant Garamond',serif" }}>年間メニュー構成</div>
                    <div style={{ display:"flex", gap:16, alignItems:"center" }}>
                      <PieChart data={bd} size={110} />
                      <div style={{ flex:1 }}>
                        {bd.slice(0,6).map((d,i) => (
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:10, height:10, borderRadius:2, background:PIE_COLORS[i%PIE_COLORS.length], flexShrink:0 }} /><span style={{ fontSize:12, color:T.text }}>{d.name}</span></div>
                            <span style={{ fontSize:11, color:T.muted }}>{Math.round(d.pct*100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                ) : null; })()}
                <Card>
                  <div style={{ fontSize:12, color:T.sub, marginBottom:10, fontFamily:"'Cormorant Garamond',serif" }}>月別売上（タップで詳細）</div>
                  <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:160 }}>
                    {monthlyData.map((d,i) => {
                      const pct = maxAmt>0 ? d.amt/maxAmt : 0; const barH = Math.max(pct*130, d.amt>0?6:0);
                      const isCurrentMonth = new Date().getFullYear()===graphYear && new Date().getMonth()===i;
                      return (
                        <div key={i} onClick={() => d.amt>0 && setGraphMonthSel(i)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, cursor:d.amt>0?"pointer":"default" }}>
                          {d.amt>0 && <div style={{ fontSize:9, color:T.muted, textAlign:"center" }}>¥{(d.amt/1000).toFixed(0)}k</div>}
                          <div style={{ width:"100%", height:barH, background:isCurrentMonth?T.accent:T.accent+"60", borderRadius:"4px 4px 0 0", transition:"height 0.3s" }} />
                          <div style={{ fontSize:9, color:isCurrentMonth?T.accent:T.muted, fontWeight:isCurrentMonth?"bold":"normal" }}>{d.month}</div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
                <Card style={{ padding:0, overflow:"hidden", marginTop:10 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", background:T.accent+"18", padding:"9px 14px", borderBottom:`1px solid ${T.border}` }}>
                    {["月","件数","売上"].map((h,i) => <div key={h} style={{ fontSize:11, color:T.sub, textAlign:i>0?"right":"left" }}>{h}</div>)}
                  </div>
                  {monthlyData.filter(d=>d.amt>0).map((d,i,arr) => (
                    <div key={i} onClick={() => setGraphMonthSel(monthlyData.indexOf(d))} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", padding:"9px 14px", borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none", cursor:"pointer" }}>
                      <div style={{ fontSize:13, color:T.accent }}>{d.month} ›</div>
                      <div style={{ fontSize:13, textAlign:"right" }}>{d.count}件</div>
                      <div style={{ fontSize:13, textAlign:"right" }}>¥{d.amt.toLocaleString()}</div>
                    </div>
                  ))}
                  {monthlyData.every(d=>d.amt===0) && <div style={{ fontSize:13, color:T.muted, textAlign:"center", padding:"20px 0" }}>{graphYear}年のデータがありません</div>}
                </Card>
              </> : <>
                {(() => {
                  const mm = String(graphMonthSel+1).padStart(2,"0");
                  const mKartes = kartes.filter(k => k.date.startsWith(`${graphYear}-${mm}`));
                  const mAmt = mKartes.reduce((s,k)=>s+(parseInt(k.price)||0),0);
                  const bd = menuBreakdown(mKartes);
                  return <>
                    <div style={{ display:"flex", gap:10, marginBottom:16 }}>
                      <Card style={{ flex:1, padding:"12px 14px", marginBottom:0 }}><div style={{ fontSize:11, color:T.sub, fontFamily:"'Cormorant Garamond',serif" }}>月間売上</div><div style={{ fontSize:20, fontWeight:"bold", color:T.accent, marginTop:2 }}>¥{mAmt.toLocaleString()}</div></Card>
                      <Card style={{ flex:1, padding:"12px 14px", marginBottom:0 }}><div style={{ fontSize:11, color:T.sub, fontFamily:"'Cormorant Garamond',serif" }}>件数</div><div style={{ fontSize:20, fontWeight:"bold", color:T.accent, marginTop:2 }}>{mKartes.length}<span style={{ fontSize:13, color:T.muted, marginLeft:2 }}>件</span></div></Card>
                    </div>
                    {bd.length > 0 && (
                      <Card style={{ marginBottom:16 }}>
                        <div style={{ fontSize:12, color:T.sub, marginBottom:14, fontFamily:"'Cormorant Garamond',serif" }}>メニュー構成</div>
                        <div style={{ display:"flex", gap:16, alignItems:"center" }}>
                          <PieChart data={bd} size={110} />
                          <div style={{ flex:1 }}>
                            {bd.slice(0,6).map((d,i) => (
                              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:10, height:10, borderRadius:2, background:PIE_COLORS[i%PIE_COLORS.length], flexShrink:0 }} /><span style={{ fontSize:12, color:T.text }}>{d.name}</span></div>
                                <div style={{ textAlign:"right" }}><div style={{ fontSize:11, color:T.muted }}>{Math.round(d.pct*100)}%</div><div style={{ fontSize:10, color:T.muted }}>¥{d.amt.toLocaleString()}</div></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    )}
                    <Card style={{ padding:0, overflow:"hidden" }}>
                      <div style={{ display:"grid", gridTemplateColumns:"0.8fr 1.2fr 1fr", background:T.accent+"18", padding:"9px 14px", borderBottom:`1px solid ${T.border}` }}>
                        {["日付","お客様","金額"].map((h,i) => <div key={h} style={{ fontSize:11, color:T.sub, textAlign:i===2?"right":"left" }}>{h}</div>)}
                      </div>
                      {mKartes.sort((a,b)=>a.date.localeCompare(b.date)).map((k,i,arr) => {
                        const c = getClient(k.clientId);
                        return (
                          <div key={k.id} style={{ display:"grid", gridTemplateColumns:"0.8fr 1.2fr 1fr", padding:"9px 14px", borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none", background:i%2===0?"transparent":T.accent+"08" }}>
                            <div style={{ fontSize:12 }}>{k.date.slice(5)}</div>
                            <div style={{ fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c?.name||"不明"}</div>
                            <div style={{ fontSize:12, textAlign:"right" }}>¥{parseInt(k.price||0).toLocaleString()}</div>
                          </div>
                        );
                      })}
                      {mKartes.length === 0 && <div style={{ fontSize:13, color:T.muted, textAlign:"center", padding:"20px 0" }}>この月のカルテはありません</div>}
                    </Card>
                  </>;
                })()}
              </>}
            </>}

            {/* 設定 */}
            {tab==="settings" && <>
              <div style={{ display:"flex", gap:4, marginBottom:16, flexWrap:"wrap" }}>
                {[["salon","🏠 サロン"],["theme","🎨 テーマ"],["menus","📋 メニュー"],["payments","💳 決済"],["templates","✏️ テンプレ"],["members","👥 メンバー"],["backup","💾 バックアップ"]].map(([key,label]) => (
                  <button key={key} onClick={() => setSettingsSub(key)} style={{ padding:"8px 14px", borderRadius:20, border:`1px solid ${settingsSub===key?T.accent:T.border}`, background:settingsSub===key?T.accent:"none", color:settingsSub===key?"#fff":T.muted, cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>{label}</button>
                ))}
              </div>

              {settingsSub==="theme" && (
                <Card>
                  <div style={{ fontSize:15, fontFamily:"'Cormorant Garamond',serif", color:T.accent, marginBottom:14 }}>テーマカラー</div>
                  {Object.entries(THEMES).map(([key,th]) => (
                    <div key={key} onClick={async () => { setThemeKey(key); LS.set("sn4_theme",key); await saveSettings({ theme: key }); }} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", border:`2px solid ${themeKey===key?th.accent:th.border}`, borderRadius:10, cursor:"pointer", background:th.card, marginBottom:8 }}>
                      <div style={{ display:"flex", gap:5 }}>{[th.accent,th.sub,th.bg].map((col,i) => <div key={i} style={{ width:16, height:16, borderRadius:"50%", background:col, border:`1px solid ${th.border}`, flexShrink:0 }} />)}</div>
                      <span style={{ fontSize:14, color:th.text, fontFamily:"'Cormorant Garamond',serif" }}>{th.name}</span>
                      {themeKey===key && <span style={{ marginLeft:"auto", color:th.accent }}>✓</span>}
                    </div>
                  ))}
                </Card>
              )}

              {settingsSub==="salon" && (
                <Card>
                  <div style={{ fontSize:15, fontFamily:"'Cormorant Garamond',serif", color:T.accent, marginBottom:14 }}>サロン情報</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    <div><Lbl t="サロン名" /><input defaultValue={salonInfo.name} onBlur={async e => { const s={...salonInfo,name:e.target.value}; setSalonInfo(s); await saveSettings({ salon_name: e.target.value, genre: salonInfo.genre }); }} placeholder="Eclael nail studio" style={base} /></div>
                    <div><Lbl t="ジャンル（複数可）" /><input defaultValue={salonInfo.genre} onBlur={async e => { const s={...salonInfo,genre:e.target.value}; setSalonInfo(s); await saveSettings({ salon_name: salonInfo.name, genre: e.target.value }); }} placeholder="ネイル・エステ" style={base} /></div>
                    <div style={{ fontSize:12, color:T.muted, lineHeight:1.7 }}>入力するとヘッダーに「by サロン名」と表示されます。</div>
                  </div>
                </Card>
              )}

              {settingsSub==="salon" && (
                <Card>
                  <div style={{ fontSize:15, fontFamily:"'Cormorant Garamond',serif", color:T.accent, marginBottom:14 }}>お客様自己登録リンク</div>
                  <div style={{ fontSize:12, color:T.muted, lineHeight:1.7, marginBottom:12 }}>
                    このリンク（またはQRコード）をお客様に案内すると、ご自身で来店前アンケートに入力していただけます。入力内容は「承認待ち」タブに届きます。
                  </div>
                  {(() => {
                    const registerUrl = `${window.location.origin}/register?salon=${session.user.id}`;
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(registerUrl)}`;
                    return (
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
                        <img src={qrUrl} alt="登録用QRコード" style={{ width:160, height:160, borderRadius:12, border:`1px solid ${T.border}` }} />
                        <div style={{ width:"100%", display:"flex", gap:8 }}>
                          <input readOnly value={registerUrl} style={{ ...base, flex:1, fontSize:11 }} onFocus={e=>e.target.select()} />
                          <Btn small onClick={() => { navigator.clipboard?.writeText(registerUrl); alert("リンクをコピーしました"); }}>コピー</Btn>
                        </div>
                      </div>
                    );
                  })()}
                </Card>
              )}

              {settingsSub==="menus" && (
                <Card>
                  <div style={{ fontSize:15, fontFamily:"'Cormorant Garamond',serif", color:T.accent, marginBottom:14 }}>メニュー管理</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
                    <IMEInput value={menuForm.name} onChange={v=>setMenuForm(f=>({...f,name:v}))} placeholder="メニュー名（例: カット）" style={base} />
                    <input type="number" defaultValue={menuForm.price} key={editMenuId||"new"} onBlur={e=>setMenuForm(f=>({...f,price:e.target.value}))} placeholder="金額（税込・円）" style={base} />
                    <Btn full onClick={addMenu}>{editMenuId ? "更新する" : "追加"}</Btn>
                    {editMenuId && <Btn full color={T.sub} onClick={() => { setEditMenuId(null); setMenuForm({ name:"", price:"" }); }}>キャンセル</Btn>}
                  </div>
                  {menus.length===0 && <div style={{ fontSize:13, color:T.muted, textAlign:"center", padding:"12px 0" }}>メニューがありません</div>}
                  {menus.map(m => (
                    <div key={m.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
                      <div><span style={{ fontSize:14 }}>{m.name}</span>{m.price && <span style={{ fontSize:13, color:T.muted, marginLeft:8 }}>¥{parseInt(m.price).toLocaleString()}</span>}</div>
                      <div style={{ display:"flex", gap:6 }}>
                        <Btn small color={T.sub} onClick={() => { setEditMenuId(m.id); setMenuForm({ name:m.name, price:m.price }); }}>編集</Btn>
                        <Btn small color={T.danger} onClick={() => deleteMenu(m.id)}>削除</Btn>
                      </div>
                    </div>
                  ))}
                </Card>
              )}

              {settingsSub==="templates" && (
                <Card>
                  <div style={{ fontSize:15, fontFamily:"'Cormorant Garamond',serif", color:T.accent, marginBottom:14 }}>施術メモ テンプレート</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
                    <IMEInput value={tplForm} onChange={setTplForm} placeholder="例: ワンカラー・リタッチ" style={base} />
                    <Btn full onClick={addTpl}>追加</Btn>
                  </div>
                  {templates.length===0 && <div style={{ fontSize:13, color:T.muted, textAlign:"center", padding:"12px 0" }}>テンプレートがありません</div>}
                  {templates.map(t => (
                    <div key={t.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
                      <span style={{ fontSize:14 }}>{t.text}</span>
                      <Btn small color={T.danger} onClick={() => deleteTpl(t.id)}>削除</Btn>
                    </div>
                  ))}
                </Card>
              )}

              {settingsSub==="payments" && (
                <Card>
                  <div style={{ fontSize:15, fontFamily:"'Cormorant Garamond',serif", color:T.accent, marginBottom:14 }}>決済方法管理</div>
                  <PaymentAddForm payments={payments} savePayments={savePayments} base={base} T={T} Btn={Btn} />
                  <div style={{ fontSize:12, color:T.muted, marginBottom:10 }}>登録済み</div>
                  {payments.map((p,i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
                      <span style={{ fontSize:14 }}>{p}</span>
                      {!["現金","クレジット","電子マネー"].includes(p)
                        ? <Btn small color={T.danger} onClick={() => savePayments(payments.filter((_,j)=>j!==i))}>削除</Btn>
                        : <span style={{ fontSize:11, color:T.muted }}>デフォルト</span>}
                    </div>
                  ))}
                </Card>
              )}

              {settingsSub==="members" && (
                <Card>
                  <div style={{ fontSize:15, fontFamily:"'Cormorant Garamond',serif", color:T.accent, marginBottom:6 }}>メンバー管理</div>
                  <div style={{ fontSize:12, color:T.muted, marginBottom:14, lineHeight:1.7 }}>最大5人までメンバーを招待できます。<br/>招待URLを発行してスタッフに共有してください。</div>
                  {isOwner && (
                    <div style={{ marginBottom:16 }}>
                      <Btn full onClick={generateInvite} disabled={inviteLoading}>{inviteLoading?"生成中...":"🔗 招待URLを発行"}</Btn>
                      {inviteUrl && (
                        <div style={{ marginTop:12, background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 14px" }}>
                          <div style={{ fontSize:11, color:T.sub, marginBottom:6 }}>招待URL（一度だけ使用可能）</div>
                          <div style={{ fontSize:12, color:T.accent, wordBreak:"break-all", marginBottom:10 }}>{inviteUrl}</div>
                          <Btn small onClick={() => { navigator.clipboard.writeText(inviteUrl); alert("コピーしました！"); }}>📋 コピー</Btn>
                        </div>
                      )}
                    </div>
                  )}
                  {members.length===0 && <div style={{ fontSize:13, color:T.muted, textAlign:"center", padding:"12px 0" }}>メンバーを読み込み中...</div>}
                  {members.map(m => (
                    <div key={m.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:`1px solid ${T.border}` }}>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:14 }}>{m.role==="owner"?"👑 オーナー":"👤 スタッフ"}</span>
                          <span style={{ fontSize:11, background:m.status==="active"?T.accent+"22":"#ffaa0022", color:m.status==="active"?T.accent:"#cc8800", borderRadius:20, padding:"2px 8px" }}>{m.status==="active"?"有効":"承認待ち"}</span>
                        </div>
                        {m.user_id === session.user.id && <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>（あなた）</div>}
                      </div>
                      {isOwner && m.user_id !== session.user.id && (
                        <div style={{ display:"flex", gap:6 }}>
                          {m.status==="pending" && <Btn small onClick={() => approveMember(m.id)}>承認</Btn>}
                          <Btn small color={T.danger} onClick={() => removeMember(m.id)}>削除</Btn>
                        </div>
                      )}
                    </div>
                  ))}
                </Card>
              )}

              {settingsSub==="backup" && <>
                <Card>
                  <div style={{ fontSize:15, fontFamily:"'Cormorant Garamond',serif", color:T.accent, marginBottom:8 }}>バックアップ</div>
                  <div style={{ fontSize:12, color:T.muted, marginBottom:14, lineHeight:1.7 }}>データはこのブラウザに保存されています。<br/>定期的にエクスポートしておくと安心です。</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    <Btn full onClick={doExport}>📥 エクスポート（バックアップ保存）</Btn>
                    <input type="file" accept=".json" ref={importRef} style={{ display:"none" }} onChange={doImport} />
                    <Btn full color={T.sub} onClick={() => importRef.current.click()}>📤 インポート（バックアップから復元）</Btn>
                  </div>
                </Card>
                <Card>
                  <div style={{ fontSize:15, fontFamily:"'Cormorant Garamond',serif", color:T.accent, marginBottom:8 }}>データ情報</div>
                  <div style={{ fontSize:13, color:T.muted, marginBottom:12 }}>顧客 {clients.length}件　/　カルテ {kartes.length}件　/　メニュー {menus.length}件</div>
                  <Btn color={T.danger} onClick={() => { if (confirm("全データを削除しますか？この操作は戻せません。")) { saveC([]); saveK([]); } }}>全データを削除</Btn>
                </Card>
              </>}
            </>}

            {/* ═══ アンケート（設定タブの下に常時表示） ═══ */}
            {tab === "settings" && (
              <div style={{ marginTop:24, marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <div style={{ flex:1, height:1, background:T.border }} />
                  <span style={{ fontSize:11, color:T.muted, letterSpacing:"0.1em", fontFamily:"'Cormorant Garamond',serif", whiteSpace:"nowrap" }}>ご意見・ご要望</span>
                  <div style={{ flex:1, height:1, background:T.border }} />
                </div>
                <div style={{ background:T.accent+"0e", border:`1px solid ${T.accent}30`, borderRadius:14, padding:"18px 16px" }}>
                  <div style={{ fontSize:13, color:T.accent, fontFamily:"'Cormorant Garamond',serif", marginBottom:4 }}>🌷 アプリへのご意見をお聞かせください</div>
                  <div style={{ fontSize:11, color:T.muted, marginBottom:12, lineHeight:1.7 }}>機能のご要望・使いにくい点・改善してほしいことなど、なんでもお気軽にどうぞ。</div>
                  <IMEArea
                    value={feedbackText}
                    onChange={setFeedbackText}
                    placeholder="例: カルテに写真を複数枚追加したい、○○の操作がわかりにくい…"
                    rows={4}
                    style={{ ...base, resize:"vertical", marginBottom:10 }}
                  />
                  {feedbackSent && (
                    <div style={{ fontSize:12, color:T.accent, background:T.accent+"18", borderRadius:8, padding:"8px 12px", marginBottom:10 }}>
                      ✓ 送信しました！ありがとうございます🌷
                    </div>
                  )}
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <Btn full onClick={submitFeedback} disabled={feedbackSending||!feedbackText.trim()}>
                      {feedbackSending ? "送信中..." : "送信する"}
                    </Btn>
                    {isOwner && (
                      <button onClick={fetchFeedback} style={{ width:"100%", fontSize:12, color:T.muted, background:"none", border:`1px solid ${T.border}`, borderRadius:9, padding:"10px 14px", cursor:"pointer", fontFamily:"inherit" }}>
                        📋 受信したご意見を見る
                      </button>
                    )}
                  </div>

                  {/* フィードバック一覧（オーナーのみ） */}
                  {showFeedbackList && isOwner && (
                    <div style={{ marginTop:16, borderTop:`1px solid ${T.border}`, paddingTop:14 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                        <div style={{ fontSize:12, color:T.sub, fontFamily:"'Cormorant Garamond',serif" }}>受信したご意見 {feedbackList.length}件</div>
                        <button onClick={() => setShowFeedbackList(false)} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:16, lineHeight:1 }}>×</button>
                      </div>
                      {feedbackList.length === 0 && <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"12px 0" }}>まだ意見はありません</div>}
                      {feedbackList.map(f => (
                        <div key={f.id} style={{ background:T.card, borderRadius:9, padding:"10px 13px", marginBottom:8, border:`1px solid ${T.border}` }}>
                          <div style={{ fontSize:11, color:T.muted, marginBottom:4 }}>{new Date(f.created_at).toLocaleString("ja-JP")}</div>
                          <div style={{ fontSize:13, color:T.text, lineHeight:1.7, whiteSpace:"pre-wrap" }}>{f.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>{/* content-area */}
        </div>{/* main */}
      </div>{/* pc layout */}

      {/* Backup alert */}
      {showBackupAlert && (
        <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:300, background:"#c8937a", color:"#fff", padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.2)" }}>
          <div>
            <div style={{ fontSize:13, fontWeight:"bold" }}>💾 バックアップのすすめ</div>
            <div style={{ fontSize:11, marginTop:2, opacity:0.9 }}>データを定期的にエクスポートしましょう</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => { setTab("settings"); setSettingsSub("backup"); setShowBackupAlert(false); }} style={{ background:"#fff", color:"#c8937a", border:"none", borderRadius:8, padding:"6px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>今すぐ保存</button>
            <button onClick={() => setShowBackupAlert(false)} style={{ background:"rgba(255,255,255,0.3)", color:"#fff", border:"none", borderRadius:8, padding:"6px 10px", fontSize:14, cursor:"pointer" }}>×</button>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div className="mobile-nav" style={{ position:"fixed", bottom:0, left:0, right:0, background:T.card, borderTop:`1px solid ${T.border}`, zIndex:80, flexDirection:"column" }}>
        <div style={{ display:"flex", width:"100%" }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => setTab(n.key)} style={{ flex:1, padding:"6px 0 8px", border:"none", background:"none", cursor:"pointer", borderTop:tab===n.key?`2px solid ${T.accent}`:"2px solid transparent", fontFamily:"inherit", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
              <SvgIcon type={n.key} color={tab===n.key?T.accent:T.muted} />
              <div style={{ fontSize:9, color:tab===n.key?T.accent:T.muted, whiteSpace:"nowrap" }}>{n.shortLabel||n.label}</div>
            </button>
          ))}
        </div>
        <div style={{ width:"100%", textAlign:"center", padding:"2px 0 4px", fontSize:8, color:T.muted, letterSpacing:"0.06em", opacity:0.5 }}>Powered by sorato.</div>
      </div>

      {/* PC footer */}
      <div className="pc-sidebar" style={{ position:"fixed", bottom:0, left:0, width:220, padding:"10px 24px", background:T.card, borderTop:`1px solid ${T.border}`, borderRight:`1px solid ${T.border}` }}>
        <div style={{ fontSize:10, color:T.muted, letterSpacing:"0.08em" }}>Powered by sorato.</div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <img src={lightbox} alt="" style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain", display:"block" }} />
          <button onClick={() => setLightbox(null)} style={{ position:"absolute", top:16, right:16, background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", fontSize:26, width:40, height:40, borderRadius:"50%", cursor:"pointer", lineHeight:"40px", textAlign:"center" }}>×</button>
        </div>
      )}

      {/* 顧客モーダル */}
      {showClientModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={e => { if (e.target===e.currentTarget) closeClientModal(); }}>
          <div style={{ background:T.card, borderRadius:"18px 18px 0 0", width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto", padding:"22px 18px 44px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:T.accent, letterSpacing:"0.1em" }}>{editClientId?"顧客を編集":"顧客を追加"}</span>
              <button onClick={closeClientModal} style={{ background:"none", border:"none", fontSize:24, color:T.muted, cursor:"pointer", lineHeight:1 }}>×</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
              <div><Lbl t="お名前 *" /><IMEInput value={cf.name} onChange={v=>{ setCf(f=>({...f,name:v})); setClientDirty(true); }} placeholder="山田 花子" style={base} /></div>
              <div><Lbl t="電話番号 *" /><IMEInput value={cf.phone} onChange={v=>{ setCf(f=>({...f,phone:v})); setClientDirty(true); }} placeholder="09012345678（ハイフン不要）" style={base} /></div>
              <div><Lbl t="メール" /><IMEInput value={cf.email} onChange={v=>{ setCf(f=>({...f,email:v})); setClientDirty(true); }} placeholder="example@mail.com" style={base} /></div>
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                  <Lbl t="誕生日" />
                  {cf.birthday && <button onClick={() => setCf(f=>({...f,birthday:""}))} style={{ fontSize:11, color:T.muted, background:"none", border:`1px solid ${T.border}`, borderRadius:14, padding:"2px 10px", cursor:"pointer" }}>クリア</button>}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <select value={cf.birthday?cf.birthday.slice(0,4):""} onChange={e => { const y=e.target.value; const cur=cf.birthday||"----01-01"; setCf(f=>({...f,birthday:y?y+cur.slice(4):""})); setClientDirty(true); }} style={{ ...base, flex:2 }}>
                    <option value="">年</option>
                    {Array.from({length:80},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y} value={y}>{y}年</option>)}
                  </select>
                  <select value={cf.birthday?cf.birthday.slice(5,7):""} onChange={e => { const m=e.target.value; const cur=cf.birthday||(new Date().getFullYear()+"-01-01"); setCf(f=>({...f,birthday:cur.slice(0,4)+"-"+m+cur.slice(7)})); setClientDirty(true); }} style={{ ...base, flex:1 }}>
                    <option value="">月</option>
                    {Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0")).map(m=><option key={m} value={m}>{parseInt(m)}月</option>)}
                  </select>
                  <select value={cf.birthday?cf.birthday.slice(8,10):""} onChange={e => { const d=e.target.value; const cur=cf.birthday||(new Date().getFullYear()+"-01-01"); setCf(f=>({...f,birthday:cur.slice(0,7)+"-"+d})); setClientDirty(true); }} style={{ ...base, flex:1 }}>
                    <option value="">日</option>
                    {Array.from({length:31},(_,i)=>String(i+1).padStart(2,"0")).map(d=><option key={d} value={d}>{parseInt(d)}日</option>)}
                  </select>
                </div>
              </div>
              <div><Lbl t="アレルギー・注意事項" /><IMEArea value={cf.allergy} onChange={v=>{ setCf(f=>({...f,allergy:v})); setClientDirty(true); }} placeholder="例: パーマ液アレルギー" rows={2} style={{...base,resize:"vertical"}} /></div>
              <div><Lbl t="その他注意事項" /><IMEArea value={cf.notes} onChange={v=>{ setCf(f=>({...f,notes:v})); setClientDirty(true); }} placeholder="例: 消毒エタノール注意" rows={2} style={{...base,resize:"vertical"}} /></div>
              <div><Lbl t="特徴メモ" /><IMEArea value={cf.memo} onChange={v=>{ setCf(f=>({...f,memo:v})); setClientDirty(true); }} placeholder="例: 犬2匹いる、旅行好き" rows={2} style={{...base,resize:"vertical"}} /></div>
              <Btn full onClick={submitClient}>{editClientId?"更新する":"保存する"}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* カルテモーダル */}
      {showKarteModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={e => { if (e.target===e.currentTarget) closeKarteModal(); }}>
          <div style={{ background:T.card, borderRadius:"18px 18px 0 0", width:"100%", maxWidth:520, maxHeight:"92vh", overflowY:"auto", padding:"22px 18px 44px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:T.accent, letterSpacing:"0.1em" }}>{editKarteId?"カルテを編集":"カルテを記入"}</span>
              <button onClick={closeKarteModal} style={{ background:"none", border:"none", fontSize:24, color:T.muted, cursor:"pointer", lineHeight:1 }}>×</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
              <div>
                <Lbl t="お客様 *" />
                <div style={{ position:"relative" }}>
                  <IMEInput value={kf.clientId&&!pickerOpen?(getClient(kf.clientId)?.name||""):pickerQ} onChange={v => { setPickerQ(v); setPickerOpen(true); setKf(f=>({...f,clientId:""})); }} placeholder="名前で検索して選択..." style={base} />
                  {!pickerOpen&&kf.clientId && <div style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", cursor:"pointer", color:T.muted, fontSize:18, lineHeight:1 }} onClick={() => { setPickerQ(""); setPickerOpen(true); setKf(f=>({...f,clientId:""})); }}>×</div>}
                  {pickerOpen&&pickerClients.length>0 && (
                    <div style={{ position:"absolute", top:"100%", left:0, right:0, background:T.card, border:`1px solid ${T.border}`, borderRadius:9, zIndex:300, maxHeight:160, overflowY:"auto", boxShadow:"0 6px 20px rgba(0,0,0,0.12)" }}>
                      {pickerClients.map(c => (
                        <div key={c.id} onClick={() => { setKf(f=>({...f,clientId:c.id})); setPickerQ(""); setPickerOpen(false); }} style={{ padding:"11px 14px", cursor:"pointer", fontSize:14, borderBottom:`1px solid ${T.border}` }}>
                          {c.name} <span style={{ color:T.muted, fontSize:12 }}>{c.phone}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {kf.clientId&&getClient(kf.clientId)?.allergy && <div style={{ fontSize:11, color:"#d06050", marginTop:5 }}>⚠ {getClient(kf.clientId).allergy}</div>}
              </div>
              <div><Lbl t="日付 *" /><input type="date" value={kf.date} onChange={e=>setKf(f=>({...f,date:e.target.value}))} style={{ ...base, WebkitAppearance:"none", appearance:"none", maxWidth:"100%" }} /></div>
              {menus.length>0 && (
                <div>
                  <Lbl t="メニューから選ぶ（任意）" />
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    <button onClick={() => setKf(f=>({...f,menuId:"",price:f.price}))} style={{ padding:"6px 12px", borderRadius:20, border:`1px solid ${T.border}`, background:!kf.menuId?T.accent:"none", color:!kf.menuId?"#fff":T.muted, cursor:"pointer", fontSize:12 }}>なし</button>
                    {menus.map(m => (
                      <button key={m.id} onClick={() => setKf(f=>({...f,menuId:m.id}))} style={{ padding:"6px 12px", borderRadius:20, border:`1px solid ${kf.menuId===m.id?T.accent:T.border}`, background:kf.menuId===m.id?T.accent:"none", color:kf.menuId===m.id?"#fff":T.text, cursor:"pointer", fontSize:12 }}>{m.name}{m.price?` ¥${parseInt(m.price).toLocaleString()}`:""}</button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Lbl t="金額（円）" />
                <div style={{ display:"flex", gap:8 }}>
                  <input type="number" value={kf.price} onChange={e=>{ setKf(f=>({...f,price:e.target.value})); setKarteDirty(true); }} placeholder="例: 6000（税込）" style={{ ...base, flex:1 }} />
                  <Btn small color={T.sub} onClick={() => setShowNailCalc(true)}>デザイン料金を計算</Btn>
                </div>
              </div>
              <div>
                <Lbl t="お支払い方法" />
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {payments.map(p => (
                    <button key={p} onClick={() => { setKf(f=>({...f,payment:f.payment===p?"":p})); setKarteDirty(true); }} style={{ padding:"7px 14px", borderRadius:20, border:`1px solid ${kf.payment===p?T.accent:T.border}`, background:kf.payment===p?T.accent:"none", color:kf.payment===p?"#fff":T.text, cursor:"pointer", fontSize:13, fontFamily:"inherit" }}>{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                  <Lbl t="施術メモ" />
                  {templates.length>0 && <button onClick={() => setShowTplPicker(v=>!v)} style={{ fontSize:11, color:T.accent, background:"none", border:`1px solid ${T.accent}`, borderRadius:14, padding:"2px 10px", cursor:"pointer" }}>テンプレ {showTplPicker?"▲":"▼"}</button>}
                </div>
                {showTplPicker && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
                    {templates.map(t => (
                      <button key={t.id} onClick={() => { setKf(f=>({...f,treatMemo:(f.treatMemo?f.treatMemo+"\n":"")+t.text})); setShowTplPicker(false); }} style={{ padding:"5px 12px", borderRadius:16, border:`1px solid ${T.border}`, background:T.bg, color:T.text, cursor:"pointer", fontSize:12 }}>{t.text}</button>
                    ))}
                  </div>
                )}
                <IMEArea value={kf.treatMemo} onChange={v=>{ setKf(f=>({...f,treatMemo:v})); setKarteDirty(true); }} placeholder="カット・カラー 7N…" rows={3} style={{...base,resize:"vertical"}} />
              </div>
              <div><Lbl t="会話メモ" /><IMEArea value={kf.talkMemo} onChange={v=>setKf(f=>({...f,talkMemo:v}))} placeholder="旅行の話、次回パーマ希望…" rows={3} style={{...base,resize:"vertical"}} /></div>
              <div>
                <Lbl t="写真（1枚）" />
                {kf.photo && <img src={kf.photo} alt="" style={{ width:"100%", borderRadius:8, marginBottom:8, display:"block", objectFit:"contain" }} />}
                <div style={{ display:"flex", gap:8 }}>
                  <input type="file" accept="image/*" ref={photoRef} style={{ display:"none" }} onChange={handlePhoto} />
                  <Btn small color={T.sub} onClick={() => photoRef.current.click()}>📷 写真を選ぶ</Btn>
                  {kf.photo && <Btn small color={T.danger} onClick={() => setKf(f=>({...f,photo:""}))}>削除</Btn>}
                </div>
              </div>
              <Btn full onClick={submitKarte} disabled={!kf.clientId||!kf.date}>{editKarteId?"更新する":"保存する"}</Btn>
            </div>
          </div>
        </div>
      )}

      {showNailCalc && (
        <NailPricingModal
          settings={pricingSettings}
          onSaveSettings={savePricingSettings}
          onClose={() => setShowNailCalc(false)}
          onConfirm={(total) => {
            setKf(f => ({ ...f, price: String(total) }));
            setKarteDirty(true);
            setShowNailCalc(false);
          }}
        />
      )}
    </div>
  );
}
