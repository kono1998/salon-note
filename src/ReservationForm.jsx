import { useState, useEffect } from "react";
import { supabase } from "./supabase";

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

  useEffect(() => {
    if (!salonId) return;
    supabase.rpc("get_salon_public_info", { p_user_id: salonId }).then(({ data, error }) => {
      if (error) { console.error("salon info fetch error:", error); return; }
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.salon_name) setSalonName(row.salon_name);
      if (Array.isArray(row?.menus)) setMenus(row.menus);
    });
  }, [salonId]);

  const salonDisplay = salonName || "SALON NOTE";

  const todayStr = new Date().toISOString().slice(0, 10);

  const submit = async () => {
    if (!form.name.trim() || !form.phone.trim()) { alert("お名前と電話番号は必須です"); return; }
    if (!form.desired_date) { alert("ご希望日をお選びください"); return; }
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
          <label style={s.lbl}>ご希望日 *</label>
          <input style={{ ...s.inp, WebkitAppearance:"none", appearance:"none" }} type="date" min={todayStr} value={form.desired_date} onChange={e=>setForm(f=>({...f,desired_date:e.target.value}))} />
          <label style={s.lbl}>ご希望時間</label>
          <input style={{ ...s.inp, WebkitAppearance:"none", appearance:"none" }} type="time" value={form.desired_time} onChange={e=>setForm(f=>({...f,desired_time:e.target.value}))} />
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
