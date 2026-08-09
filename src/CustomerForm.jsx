import { useState } from "react";
import { supabase } from "./supabase";

export default function CustomerForm({ salonId }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name:"", phone:"", birthday:"", address:"", allergy:"" });
  const [agrees, setAgrees] = useState({ service:false, privacy:false, cancel:false });
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!agrees.service || !agrees.privacy || !agrees.cancel) { alert("全ての同意が必要です"); return; }
    if (!form.name.trim()) { alert("お名前は必須です"); return; }
    setLoading(true);
    const { error } = await supabase.from("pending_clients").insert([{
      user_id: salonId,
      name: form.name, phone: form.phone,
      birthday: form.birthday, address: form.address, allergy: form.allergy,
      agree_service: agrees.service, agree_privacy: agrees.privacy, agree_cancel: agrees.cancel,
    }]);
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
    policy: { fontSize:12, color:"#7a6a60", lineHeight:1.8, maxHeight:120, overflowY:"auto", marginBottom:12, padding:"8px", background:"#fdf7f4", borderRadius:8 },
  };

  if (!salonId) return (
    <div style={s.wrap}>
      <div style={{ ...s.body, textAlign:"center", paddingTop:60 }}>
        <div style={{ fontSize:48, marginBottom:20 }}>⚠️</div>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:"#c8937a", marginBottom:12 }}>このリンクは無効です</div>
        <div style={{ fontSize:14, color:"#7a6a60", lineHeight:1.8 }}>
          サロンからご案内されたQRコードまたはリンクから<br/>アクセスしてください。
        </div>
      </div>
    </div>
  );

  if (done) return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.title}>✦ Eclael nail studio</div>
        <div style={s.sub}>エクラエルネイルスタジオ</div>
      </div>
      <div style={{ ...s.body, textAlign:"center", paddingTop:60 }}>
        <div style={{ fontSize:48, marginBottom:20 }}>✨</div>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:"#c8937a", marginBottom:12 }}>ご登録ありがとうございます🌼</div>
        <div style={{ fontSize:14, color:"#7a6a60", lineHeight:1.8 }}>
          本日はお越しいただきまして<br/>誠にありがとうございます🙇‍♀️
        </div>
      </div>
    </div>
  );

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.title}>✦ Eclael nail studio</div>
        <div style={s.sub}>新規カルテ登録</div>
      </div>
      <div style={s.body}>

        {step === 1 && <>
          <div style={{ fontSize:14, color:"#7a6a60", marginBottom:24, lineHeight:1.8 }}>
            はじめてご来店いただきありがとうございます。<br/>以下の情報をご入力ください。
          </div>
          <label style={s.lbl}>お名前 *</label>
          <input style={s.inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="山田 花子" />
          <label style={s.lbl}>電話番号 *</label>
          <input style={s.inp} type="tel" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="090-0000-0000" />
          <label style={s.lbl}>生年月日</label>
          <input style={{ ...s.inp, WebkitAppearance:"none", appearance:"none" }} type="date" value={form.birthday} onChange={e=>setForm(f=>({...f,birthday:e.target.value}))} />
          <label style={s.lbl}>ご住所</label>
          <input style={s.inp} value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="東京都〇〇区..." />
          <label style={s.lbl}>アレルギー・注意事項（任意）</label>
          <textarea style={{ ...s.inp, resize:"vertical" }} rows={3} value={form.allergy} onChange={e=>setForm(f=>({...f,allergy:e.target.value}))} placeholder="アレルギーや皮膚に関するご注意があればご記入ください" />
          <button style={s.btn} onClick={() => { if (!form.name||!form.phone) { alert("お名前と電話番号は必須です"); return; } setStep(2); }}>次へ →</button>
        </>}

        {step === 2 && <>
          <div style={{ fontSize:14, color:"#7a6a60", marginBottom:20, lineHeight:1.8 }}>
            以下の規約・ポリシーをご確認の上、同意をお願いします。
          </div>

          <div style={s.box}>
            <div style={{ fontSize:14, fontWeight:"bold", color:"#3d2c26", marginBottom:8 }}>サービス利用規約</div>
            <div style={s.policy}>
              第1条（適用）本規約は、Eclael nail studio（以下「当サロン」）が提供するネイルサービスの利用に関する条件を定めるものです。{"\n\n"}
              第2条（サービス内容）当サロンは、ネイルケア・ネイルアート等のサービスを提供します。施術内容は予約時にご確認いただいた内容に基づきます。{"\n\n"}
              第3条（健康状態）爪や皮膚に異常がある場合、施術をお断りする場合があります。施術前に必ずスタッフにお申し出ください。{"\n\n"}
              第4条（免責事項）施術後のトラブルについて、当サロンの過失によるものを除き、責任を負いかねます。アレルギー等の事前申告をお願いします。
            </div>
            <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", fontSize:14 }}>
              <input type="checkbox" checked={agrees.service} onChange={e=>setAgrees(a=>({...a,service:e.target.checked}))} style={{ width:18, height:18 }} />
              サービス利用規約に同意します
            </label>
          </div>

          <div style={s.box}>
            <div style={{ fontSize:14, fontWeight:"bold", color:"#3d2c26", marginBottom:8 }}>プライバシーポリシー</div>
            <div style={s.policy}>
              Eclael nail studioは、お客様の個人情報を以下の目的で使用します。{"\n\n"}
              ・予約管理およびサービス提供のため{"\n"}
              ・施術履歴の管理のため{"\n"}
              ・ご連絡・ご案内のため{"\n\n"}
              収集した個人情報は、第三者への提供は行いません。お客様の個人情報は適切に管理し、法令に基づき対応いたします。個人情報の開示・訂正・削除のご要望はスタッフまでお申し出ください。
            </div>
            <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", fontSize:14 }}>
              <input type="checkbox" checked={agrees.privacy} onChange={e=>setAgrees(a=>({...a,privacy:e.target.checked}))} style={{ width:18, height:18 }} />
              プライバシーポリシーに同意します
            </label>
          </div>

          <div style={s.box}>
            <div style={{ fontSize:14, fontWeight:"bold", color:"#3d2c26", marginBottom:8 }}>キャンセルについて</div>
            <div style={s.policy}>
              ご予約のキャンセル・変更は、前日までにご連絡いただけると大変助かります。{"\n\n"}
              やむを得ない事情でのキャンセルはもちろん対応しております。ただし、度重なるキャンセルが続く場合は、次回以降のご予約時に個別でご相談させていただく場合がございます。{"\n\n"}
              ご連絡はLINEまたはお電話にてお願いします。なお、遅刻の場合は施術時間が短縮される場合があります。どうぞお気軽にご連絡ください🌸
            </div>
            <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", fontSize:14 }}>
              <input type="checkbox" checked={agrees.cancel} onChange={e=>setAgrees(a=>({...a,cancel:e.target.checked}))} style={{ width:18, height:18 }} />
              上記の内容を確認しました
            </label>
          </div>

          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <button style={{ ...s.btn, background:"#b09a92", flex:1 }} onClick={() => setStep(1)}>← 戻る</button>
            <button style={{ ...s.btn, flex:2, opacity:(!agrees.service||!agrees.privacy||!agrees.cancel)?0.5:1 }} onClick={submit} disabled={loading}>
              {loading ? "送信中..." : "送信する ✓"}
            </button>
          </div>
        </>}

      </div>
    </div>
  );
}
