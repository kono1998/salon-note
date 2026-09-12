import { useState, useEffect, useMemo, Fragment } from "react";
import { supabase } from "./supabase";

const WEEKDAYS = ["日","月","火","水","木","金","土"];
const pad2 = n => String(n).padStart(2, "0");
const toDateStr = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const formatJpDate = dStr => {
  const dt = new Date(dStr + "T00:00:00");
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日（${WEEKDAYS[dt.getDay()]}）`;
};
const fmtShort = d => `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;

// 予約の時間刻み幅（15分固定）。営業開始・最終受付時刻はサロンごとにsalon_settingsで設定し、
// フォーム側ではRPC（get_salon_public_info）経由で取得する。未取得時のみ以下を仮値として使う。
const DEFAULT_BUSINESS_START = "10:00";
const DEFAULT_BUSINESS_LAST_START = "18:45";
const SLOT_MINUTES = 15;
// endStrは「営業終了時刻」ではなく「最終受付（開始）時刻」なので、endStr自身も枠に含める（<=）。
function buildTimeSlots(startStr, endStr, stepMin) {
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  const startMin = sh * 60 + sm, endMin = eh * 60 + em;
  const slots = [];
  for (let t = startMin; t <= endMin; t += stepMin) {
    slots.push(`${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`);
  }
  return slots;
}

// 月表示カレンダー用のセル配列を作る（先頭・末尾はnullで埋めて7列グリッドにする）
function buildMonthGrid(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function ReservationForm() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name:"", phone:"", desired_date:"", desired_time:"", menu_id:"", memo:"" });
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  // このフォームがどのサロン（オーナー）宛のものかをURLの ?salon=user_id から取得
  const [salonId] = useState(() => new URLSearchParams(window.location.search).get("salon") || "");
  // サロン名・メニュー一覧は、DB直参照ではなく安全なRPC（get_salon_public_info）経由で取得する。
  // salon_settingsテーブル自体はオーナー本人しかSELECTできないため、
  // 匿名のお客様がこのフォームからサロン名/メニューを読める唯一の安全な経路がこのRPC。
  const [salonName, setSalonName] = useState("");
  const [menus, setMenus] = useState([]);
  // 予約日程選択：月カレンダー表示 → 日付タップで週×時間枠グリッドに切り替え、という2段階UI
  const [pickerPhase, setPickerPhase] = useState("calendar"); // "calendar" | "slots"
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [weekStart, setWeekStart] = useState(null);
  // 営業開始・最終受付時刻（サロンごとの設定。RPCで取得できるまでは仮値を使う）
  const [hours, setHours] = useState({ start: DEFAULT_BUSINESS_START, lastStart: DEFAULT_BUSINESS_LAST_START });

  useEffect(() => {
    if (!salonId) return;
    supabase.rpc("get_salon_public_info", { p_user_id: salonId }).then(({ data, error }) => {
      if (error) { console.error("salon info fetch error:", error); return; }
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.salon_name) setSalonName(row.salon_name);
      if (Array.isArray(row?.menus)) setMenus(row.menus);
      if (row?.business_start || row?.business_last_start) {
        setHours(h => ({
          start: row.business_start || h.start,
          lastStart: row.business_last_start || h.lastStart,
        }));
      }
    });
  }, [salonId]);

  const salonDisplay = salonName || "SALON NOTE";

  const today = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  // 現時点では「今日以降＝リクエスト可能」という暫定ルール。
  // Googleカレンダー連携（実際の空き時間計算）が入り次第、ここを実データに差し替える。
  const isBookable = date => date >= today;
  const isSlotBookable = (date, timeStr) => {
    const [h, m] = timeStr.split(":").map(Number);
    const dt = new Date(date); dt.setHours(h, m, 0, 0);
    return dt >= new Date();
  };
  const isPrevMonthDisabled = calMonth.getFullYear() === today.getFullYear() && calMonth.getMonth() === today.getMonth();
  const isPrevWeekDisabled = !!weekStart && weekStart <= today;
  const calGrid = buildMonthGrid(calMonth);
  const weekDays = weekStart ? Array.from({ length:7 }, (_, i) => addDays(weekStart, i)) : [];
  const TIME_SLOTS = useMemo(() => buildTimeSlots(hours.start, hours.lastStart, SLOT_MINUTES), [hours.start, hours.lastStart]);

  const submit = async () => {
    if (!form.name.trim() || !form.phone.trim()) { alert("お名前と電話番号は必須です"); return; }
    if (!form.desired_date || !form.desired_time) { alert("ご希望の日時をお選びください"); return; }
    if (!salonId) { alert("このリンクは無効です。サロンのQRコードから再度アクセスしてください。"); return; }
    setLoading(true);
    // pending_reservationsへの直接INSERTだと、匿名ユーザーはINSERT後にその行を
    // 読み返す権限がなく（RLSでオーナーのみ閲覧可にしているため）PostgREST側で
    // エラー扱いになってしまう。SECURITY DEFINER関数（submit_pending_reservation）
    // 経由にすることで、読み返しなしに安全にINSERTだけ行う。
    const { error } = await supabase.rpc("submit_pending_reservation", {
      p_user_id: salonId,
      p_name: form.name, p_phone: form.phone,
      p_desired_date: form.desired_date, p_desired_time: form.desired_time,
      p_menu_id: form.menu_id || null, p_memo: form.memo,
    });
    setLoading(false);
    if (error) { alert("送信に失敗しました。もう一度お試しください。"); return; }
    setDone(true);
  };

  const s = {
    wrap: { minHeight:"100vh", background:"#fdf7f4", fontFamily:"'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif", padding:"0 0 40px" },
    header: { background:"#fff", borderBottom:"1px solid #ede6e2", padding:"20px 24px 14px", textAlign:"center" },
    title: { fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:"#c8937a", letterSpacing:"0.15em" },
    sub: { fontSize:11, color:"#b09a92", marginTop:2 },
    body: { maxWidth:480, margin:"0 auto", padding:"24px 20px" },
    lbl: { fontSize:12, color:"#a0897a", letterSpacing:"0.08em", marginBottom:6, display:"block", fontFamily:"'Cormorant Garamond',serif" },
    inp: { width:"100%", padding:"12px 14px", border:"1px solid #ede6e2", borderRadius:10, fontSize:15, background:"#fff", color:"#3d2c26", outline:"none", boxSizing:"border-box", fontFamily:"inherit", marginBottom:16 },
    btn: { width:"100%", padding:"14px", background:"#c8937a", color:"#fff", border:"none", borderRadius:10, fontSize:16, cursor:"pointer", fontFamily:"'Cormorant Garamond',serif", letterSpacing:"0.08em", marginTop:8 },
    box: { background:"#fff", border:"1px solid #ede6e2", borderRadius:12, padding:"16px", marginBottom:16 },
    note: { fontSize:12, color:"#7a6a60", lineHeight:1.8, marginBottom:16, padding:"10px 12px", background:"#fff7f0", borderRadius:8, border:"1px solid #f0e0d0" },
    calWrap: { border:"1px solid #ede6e2", borderRadius:12, overflow:"hidden", background:"#fff" },
    calHeader: { display:"flex", alignItems:"center", justifyContent:"space-between", background:"#c8937a", color:"#fff", padding:"8px 6px" },
    calNavBtn: { background:"none", border:"none", color:"#fff", fontSize:20, cursor:"pointer", padding:"4px 14px", lineHeight:1 },
    calNavBtnDisabled: { background:"none", border:"none", color:"rgba(255,255,255,0.35)", fontSize:20, cursor:"default", padding:"4px 14px", lineHeight:1 },
    calTitle: { fontFamily:"'Cormorant Garamond',serif", fontSize:15, letterSpacing:"0.06em" },
    calWeekRow: { display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:"1px solid #ede6e2" },
    calWeekCell: { textAlign:"center", fontSize:12, padding:"8px 0", fontWeight:600 },
    calGrid: { display:"grid", gridTemplateColumns:"repeat(7,1fr)" },
    calCell: { minHeight:46, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontSize:13, border:"none", padding:"6px 0" },
    selectedCard: { display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, border:"1px solid #ede6e2", borderRadius:12, padding:"14px 16px", background:"#fff7f0" },
    changeBtn: { flexShrink:0, padding:"8px 14px", background:"#fff", color:"#c8937a", border:"1px solid #c8937a", borderRadius:20, fontSize:12, cursor:"pointer", fontFamily:"inherit" },
    backLink: { display:"block", width:"100%", textAlign:"center", background:"none", border:"none", color:"#a0897a", fontSize:12, padding:"10px 0", cursor:"pointer", textDecoration:"underline", fontFamily:"inherit" },
    slotGridWrap: { overflowX:"auto", WebkitOverflowScrolling:"touch" },
    slotGrid: { display:"grid", gridTemplateColumns:"48px repeat(7,minmax(46px,1fr))", minWidth:520, borderTop:"1px solid #ddd0c8", borderLeft:"1px solid #ddd0c8" },
    slotCornerCell: { borderRight:"1px solid #ddd0c8", borderBottom:"1px solid #ddd0c8", background:"#faf5f2" },
    slotHeaderCell: { textAlign:"center", fontSize:12, padding:"8px 2px", fontWeight:700, borderRight:"1px solid #ddd0c8", borderBottom:"1px solid #ddd0c8", background:"#faf5f2", lineHeight:1.4 },
    slotTimeCell: { fontSize:11, color:"#8a7468", fontWeight:600, padding:"11px 3px", textAlign:"center", borderRight:"1px solid #ddd0c8", borderBottom:"1px solid #ddd0c8", background:"#fdf7f4", whiteSpace:"nowrap" },
    slotCell: { textAlign:"center", padding:"11px 2px", borderRight:"1px solid #ddd0c8", borderBottom:"1px solid #ddd0c8", borderTop:"none", borderLeft:"none", background:"#fff", fontSize:22, fontWeight:700, lineHeight:1, WebkitAppearance:"none", appearance:"none" },
  };

  if (done) return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.title}>✦ {salonDisplay}</div>
        <div style={s.sub}>ご予約リクエスト</div>
      </div>
      <div style={{ ...s.body, textAlign:"center", paddingTop:60 }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:"#c8937a", marginBottom:12 }}>予約リクエストを受け付けました</div>
        <div style={{ fontSize:14, color:"#7a6a60", lineHeight:1.8 }}>
          サロンからの確定のご連絡をお待ちください。<br/>ご希望に添えない場合もございますので、あらかじめご了承ください。
        </div>
      </div>
    </div>
  );

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.title}>✦ {salonDisplay}</div>
        <div style={s.sub}>ご予約リクエスト</div>
      </div>
      <div style={s.body}>

        {step === 1 && <>
          <div style={{ fontSize:14, color:"#7a6a60", marginBottom:24, lineHeight:1.8 }}>
            ご希望の日時・メニューをご入力ください。
          </div>
          <label style={s.lbl}>お名前 *</label>
          <input style={s.inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="山田 花子" />
          <label style={s.lbl}>電話番号 *</label>
          <input style={s.inp} type="tel" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="090-0000-0000" />

          <label style={s.lbl}>ご希望日時 *</label>

          {form.desired_date && form.desired_time ? (
            <div style={{ ...s.selectedCard, marginBottom:16 }}>
              <div>
                <div style={{ fontSize:12, color:"#a0897a" }}>選択中の日時</div>
                <div style={{ fontSize:15, color:"#3d2c26", marginTop:2 }}>{formatJpDate(form.desired_date)} {form.desired_time}〜</div>
              </div>
              <button type="button" style={s.changeBtn}
                onClick={()=>{ setWeekStart(new Date(form.desired_date + "T00:00:00")); setPickerPhase("slots"); }}>
                変更する
              </button>
            </div>
          ) : pickerPhase === "calendar" ? (
            <div style={{ marginBottom:16 }}>
              <div style={s.calWrap}>
                <div style={s.calHeader}>
                  <button type="button"
                    onClick={()=>setCalMonth(m=>{ const p=new Date(m); p.setMonth(p.getMonth()-1); return p; })}
                    disabled={isPrevMonthDisabled}
                    style={isPrevMonthDisabled ? s.calNavBtnDisabled : s.calNavBtn}>‹</button>
                  <div style={s.calTitle}>{calMonth.getFullYear()}年 {calMonth.getMonth()+1}月</div>
                  <button type="button"
                    onClick={()=>setCalMonth(m=>{ const n=new Date(m); n.setMonth(n.getMonth()+1); return n; })}
                    style={s.calNavBtn}>›</button>
                </div>
                <div style={s.calWeekRow}>
                  {WEEKDAYS.map((w,i)=>(
                    <div key={w} style={{ ...s.calWeekCell, color: i===0 ? "#c97a7a" : i===6 ? "#7a97c9" : "#a0897a" }}>{w}</div>
                  ))}
                </div>
                <div style={s.calGrid}>
                  {calGrid.map((date, i) => {
                    if (!date) return <div key={i} style={s.calCell} />;
                    const bookable = isBookable(date);
                    return (
                      <button type="button" key={i}
                        disabled={!bookable}
                        onClick={()=>{ setWeekStart(date); setPickerPhase("slots"); }}
                        style={{
                          ...s.calCell,
                          background:"transparent",
                          color: bookable ? "#3d2c26" : "#d8cec8",
                          cursor: bookable ? "pointer" : "default",
                        }}>
                        <div>{date.getDate()}</div>
                        {bookable && <div style={{ fontSize:10, color:"#c8937a", marginTop:2 }}>○</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom:16 }}>
              <div style={s.calWrap}>
                <div style={s.calHeader}>
                  <button type="button"
                    onClick={()=>setWeekStart(w=>addDays(w,-7))}
                    disabled={isPrevWeekDisabled}
                    style={isPrevWeekDisabled ? s.calNavBtnDisabled : s.calNavBtn}>‹</button>
                  <div style={s.calTitle}>{fmtShort(weekStart)}〜{fmtShort(addDays(weekStart,6))}</div>
                  <button type="button"
                    onClick={()=>setWeekStart(w=>addDays(w,7))}
                    style={s.calNavBtn}>›</button>
                </div>
                <div style={s.slotGridWrap}>
                  <div style={s.slotGrid}>
                    <div style={s.slotCornerCell} />
                    {weekDays.map((d,i)=>(
                      <div key={i} style={{ ...s.slotHeaderCell, color: d.getDay()===0 ? "#c97a7a" : d.getDay()===6 ? "#7a97c9" : "#3d2c26" }}>
                        <div>{WEEKDAYS[d.getDay()]}</div>
                        <div>{d.getDate()}</div>
                      </div>
                    ))}
                    {TIME_SLOTS.map((t, ri) => (
                      <Fragment key={ri}>
                        <div style={s.slotTimeCell}>{t}</div>
                        {weekDays.map((d, ci) => {
                          const bookable = isSlotBookable(d, t);
                          return (
                            <button type="button" key={ci}
                              disabled={!bookable}
                              onClick={()=>setForm(f=>({ ...f, desired_date: toDateStr(d), desired_time: t }))}
                              style={{ ...s.slotCell, color: bookable ? "#3f9a5c" : "#b7aca4", cursor: bookable ? "pointer" : "default" }}>
                              {bookable ? "○" : "×"}
                            </button>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
              <button type="button" style={s.backLink} onClick={()=>setPickerPhase("calendar")}>‹ カレンダー表示に戻る</button>
            </div>
          )}

          {menus.length > 0 && <>
            <label style={s.lbl}>ご希望メニュー</label>
            <div style={{ marginBottom:16 }}>
              {(() => {
                const grouped = menus.reduce((acc, m) => {
                  const cat = m.category || "メニュー";
                  (acc[cat] = acc[cat] || []).push(m);
                  return acc;
                }, {});
                const showCategory = Object.keys(grouped).length > 1;
                return Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} style={{ marginBottom:12 }}>
                  {showCategory &&
                    <div style={{ fontSize:12, color:"#a0897a", marginBottom:6, fontFamily:"'Cormorant Garamond',serif", letterSpacing:"0.05em" }}>{cat}</div>}
                  {items.map((m, i) => {
                    const val = m.id ?? m.name;
                    const selected = form.menu_id === val;
                    return (
                      <label key={val ?? i} style={{
                        display:"flex", gap:10, alignItems:"flex-start", padding:"10px 12px", marginBottom:8,
                        border:`1px solid ${selected ? "#c8937a" : "#ede6e2"}`, borderRadius:10,
                        background: selected ? "#fff7f0" : "#fff", cursor:"pointer",
                      }}>
                        <input type="radio" name="menu_id" checked={selected} onChange={()=>setForm(f=>({...f,menu_id:val}))} style={{ marginTop:4 }} />
                        {m.image && <img src={m.image} style={{ width:44, height:44, borderRadius:8, objectFit:"cover", flexShrink:0 }} />}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, color:"#3d2c26" }}>
                            {m.name}
                            {m.price && <span style={{ color:"#a0897a", marginLeft:8 }}>¥{parseInt(m.price).toLocaleString()}</span>}
                            {m.duration && <span style={{ fontSize:12, color:"#b09a92", marginLeft:6 }}>（{m.duration}分）</span>}
                          </div>
                          {m.description && <div style={{ fontSize:12, color:"#7a6a60", marginTop:4, lineHeight:1.6 }}>{m.description}</div>}
                        </div>
                      </label>
                    );
                  })}
                </div>
                ));
              })()}
            </div>
          </>}
          <label style={s.lbl}>ご要望・メモ（任意）</label>
          <textarea style={{ ...s.inp, resize:"vertical" }} rows={3} value={form.memo} onChange={e=>setForm(f=>({...f,memo:e.target.value}))} placeholder="デザインのご希望などあればご記入ください" />
          <div style={s.note}>
            ※このリクエストはまだ予約確定ではありません。サロンが内容を確認のうえ確定のご連絡をいたします。
          </div>
          <button style={s.btn} onClick={submit} disabled={loading}>
            {loading ? "送信中..." : "予約をリクエストする ✓"}
          </button>
        </>}

      </div>
    </div>
  );
}
