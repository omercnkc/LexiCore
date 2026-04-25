import { useState } from "react";
import { useAuth } from "../context/AuthContext";

/* ── small helper ── */
function getInitials(profile) {
  const name = profile?.displayName || profile?.email || "";
  return name.slice(0, 2).toUpperCase();
}

function mapFirebaseError(err) {
  const code = err?.code || "";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential")
    return "Mevcut şifreniz yanlış.";
  if (code === "auth/weak-password")
    return "Yeni şifre en az 6 karakter olmalıdır.";
  if (code === "auth/too-many-requests")
    return "Çok fazla deneme. Lütfen bekleyin.";
  return err?.message || "Bir hata oluştu.";
}

/* ─────────────────────────────────────────────
   Section card wrapper
───────────────────────────────────────────── */
function ProfileSection({ icon, title, children }) {
  return (
    <div className="profile-section">
      <div className="profile-section-header">
        <span className="profile-section-icon">{icon}</span>
        <h2 className="profile-section-title">{title}</h2>
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function ProfilePage() {
  const { user, profile, updateUserProfile, updateUserPassword } = useAuth();

  /* ── Name form ── */
  const [nameVal, setNameVal] = useState(profile?.displayName || "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState(null); // { type: "ok"|"err", text }

  /* ── Password form ── */
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  /* ── Handlers ── */
  const handleNameSave = async (e) => {
    e.preventDefault();
    if (!nameVal.trim()) { setNameMsg({ type: "err", text: "İsim boş olamaz." }); return; }
    setNameSaving(true); setNameMsg(null);
    try {
      await updateUserProfile({ displayName: nameVal.trim() });
      setNameMsg({ type: "ok", text: "İsim başarıyla güncellendi ✓" });
    } catch (err) {
      setNameMsg({ type: "err", text: mapFirebaseError(err) });
    } finally {
      setNameSaving(false);
    }
  };

  const handlePwSave = async (e) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg({ type: "err", text: "Yeni şifreler eşleşmiyor." }); return;
    }
    if (pwForm.next.length < 6) {
      setPwMsg({ type: "err", text: "Şifre en az 6 karakter olmalıdır." }); return;
    }
    setPwSaving(true); setPwMsg(null);
    try {
      await updateUserPassword({ currentPassword: pwForm.current, newPassword: pwForm.next });
      setPwMsg({ type: "ok", text: "Şifre başarıyla değiştirildi ✓" });
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      setPwMsg({ type: "err", text: mapFirebaseError(err) });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="profile-page">
      {/* ── Hero ── */}
      <div className="profile-hero">
        <div className="profile-hero-avatar">{getInitials(profile)}</div>
        <div className="profile-hero-info">
          <h1 className="profile-hero-name">
            {profile?.displayName || "Kullanıcı"}
          </h1>
          <p className="profile-hero-email">{user?.email}</p>
          <span className="profile-hero-badge">Aktif Hesap</span>
        </div>
      </div>

      <div className="profile-grid">
        {/* ── Hesap Bilgileri (readonly) ── */}
        <ProfileSection icon="👤" title="Hesap Bilgileri">
          <div className="profile-info-list">
            <div className="profile-info-row">
              <span className="profile-info-label">E-posta</span>
              <span className="profile-info-value">{user?.email}</span>
            </div>
            <div className="profile-info-row">
              <span className="profile-info-label">Kullanıcı ID</span>
              <span className="profile-info-value profile-info-mono">
                {user?.uid?.slice(0, 16)}…
              </span>
            </div>
            <div className="profile-info-row">
              <span className="profile-info-label">Son giriş</span>
              <span className="profile-info-value">
                {user?.metadata?.lastSignInTime
                  ? new Date(user.metadata.lastSignInTime).toLocaleString("tr-TR")
                  : "—"}
              </span>
            </div>
            <div className="profile-info-row">
              <span className="profile-info-label">Hesap oluşturulma</span>
              <span className="profile-info-value">
                {user?.metadata?.creationTime
                  ? new Date(user.metadata.creationTime).toLocaleString("tr-TR")
                  : "—"}
              </span>
            </div>
          </div>
        </ProfileSection>

        {/* ── İsim Güncelle ── */}
        <ProfileSection icon="✏️" title="İsim Güncelle">
          <form className="profile-form" onSubmit={handleNameSave}>
            <label className="profile-label">Görünen Ad</label>
            <input
              className="profile-input"
              type="text"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              placeholder="Adınız"
              maxLength={60}
              required
            />
            {nameMsg && (
              <p className={nameMsg.type === "ok" ? "profile-msg-ok" : "profile-msg-err"}>
                {nameMsg.text}
              </p>
            )}
            <button className="profile-btn" type="submit" disabled={nameSaving}>
              {nameSaving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </form>
        </ProfileSection>

        {/* ── Şifre Değiştir ── */}
        <ProfileSection icon="🔒" title="Şifre Değiştir">
          <form className="profile-form" onSubmit={handlePwSave}>
            <label className="profile-label">Mevcut Şifre</label>
            <input
              className="profile-input"
              type="password"
              value={pwForm.current}
              onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
              placeholder="••••••••"
              required
            />
            <label className="profile-label">Yeni Şifre</label>
            <input
              className="profile-input"
              type="password"
              value={pwForm.next}
              onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
              placeholder="En az 6 karakter"
              minLength={6}
              required
            />
            <label className="profile-label">Yeni Şifre (Tekrar)</label>
            <input
              className="profile-input"
              type="password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
              placeholder="••••••••"
              required
            />
            {pwMsg && (
              <p className={pwMsg.type === "ok" ? "profile-msg-ok" : "profile-msg-err"}>
                {pwMsg.text}
              </p>
            )}
            <button className="profile-btn" type="submit" disabled={pwSaving}>
              {pwSaving ? "Değiştiriliyor…" : "Şifreyi Değiştir"}
            </button>
          </form>
        </ProfileSection>
      </div>
    </div>
  );
}
