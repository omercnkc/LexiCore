import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { fetchDecks, createDeck } from "../api/decksApi";
import { ApiAuthError } from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { formatDeckCourseTopic, formatDeckDate, formatDeckProgress } from "../lib/deckUtils";

// ──────────────────────────────────────────────────────────────
// Modal: Manuel Deste Oluştur
// ──────────────────────────────────────────────────────────────
function CreateDeckModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ title: "", course_name: "", topic_name: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      title: form.title.trim(),
      course_name: form.course_name.trim(),
      topic_name: form.topic_name.trim(),
    };
    if (!payload.title || !payload.course_name || !payload.topic_name) {
      setFormError("Tüm alanlar zorunludur."); return;
    }
    setSubmitting(true); setFormError("");
    try {
      const deck = await createDeck(user, payload);
      onCreated(deck);
      onClose();
    } catch (err) {
      if (err instanceof ApiAuthError) return;
      setFormError(err.message || "Deste oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manuel Deste Oluştur</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form className="deck-form" onSubmit={handleSubmit}>
          {formError ? <div className="form-error">{formError}</div> : null}
          <label className="auth-field">
            <span>Deste Başlığı</span>
            <input name="title" value={form.title} onChange={handleChange} placeholder="Örn: Unit 2 Vocabulary" required />
          </label>
          <label className="auth-field">
            <span>Ders Adı</span>
            <input name="course_name" value={form.course_name} onChange={handleChange} placeholder="Örn: Biology" required />
          </label>
          <label className="auth-field">
            <span>Konu</span>
            <input name="topic_name" value={form.topic_name} onChange={handleChange} placeholder="Örn: Cell Biology" required />
          </label>
          <div className="form-actions">
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? "Oluşturuluyor..." : "Oluştur"}
            </button>
            <button className="secondary-button" type="button" onClick={onClose}>İptal</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Dashboard Page
// ──────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    if (authLoading) { setLoading(true); return () => { isActive = false; }; }
    if (!user) { setLoading(false); return () => { isActive = false; }; }

    async function loadDecks() {
      setLoading(true);
      try {
        const data = await fetchDecks(user);
        if (isActive) { setDecks(data.items || []); setError(""); }
      } catch (err) {
        if (err instanceof ApiAuthError) return;
        if (isActive) setError(err.message || "Desteler yüklenemedi.");
      } finally {
        if (isActive) setLoading(false);
      }
    }

    loadDecks();
    return () => { isActive = false; };
  }, [authLoading, user]);

  const lastDeck = decks.length > 0 ? decks[0] : null;

  return (
    <>
      {/* ── Hero Banner ── */}
      <section className="dashboard-hero">
        <div className="dashboard-hero-text">
          <h1 className="dashboard-hero-title">
            Welcome, <span className="dashboard-hero-name">{profile?.displayName || profile?.email || "Student"}</span>!
          </h1>
          <p className="dashboard-hero-lead">LET'S START</p>
          <p className="dashboard-hero-sub">
            Flashcard'larınla öğrenmeye başla. PDF yükle veya manuel deste oluştur.
          </p>
          <div className="dashboard-hero-actions">
            <Link className="hero-btn hero-btn--primary" to="/pdf">
              <span>📄</span> PDF Yükle
            </Link>
            <Link className="hero-btn hero-btn--secondary" to="/lessons">
              <span>✏️</span> Manuel Oluştur
            </Link>
          </div>
        </div>
        <div className="dashboard-hero-illustration" aria-hidden="true">
          <div className="hero-float-card hero-float-card--1">📚</div>
          <div className="hero-float-card hero-float-card--2">🧠</div>
          <div className="hero-float-card hero-float-card--3">✅</div>
        </div>
      </section>

      {error ? <div className="form-error">{error}</div> : null}

      {/* ── Bottom Two-Column Section ── */}
      <div className="dashboard-bottom-grid">
        {/* Left: Your Desks */}
        <section className="content-card dashboard-your-desks" style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Decorative background blob for the card */}
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(155, 138, 235, 0.15), transparent)', borderRadius: '50%', pointerEvents: 'none' }}></div>
          
          <div className="section-heading" style={{ marginBottom: "1.5rem", position: 'relative', zIndex: 1 }}>
            <div>
              <p className="eyebrow">Destelerim</p>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>📚</span> Your Desks
              </h2>
            </div>
            {!loading && decks.length > 0 && (
              <Link className="secondary-button" to="/lessons" style={{ fontSize: "0.85rem", padding: "8px 14px", background: 'rgba(255,255,255,0.5)' }}>
                Tümünü Gör
              </Link>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px', color: 'var(--text-soft)' }}>
              <div className="ai-status-dot" style={{ width: '12px', height: '12px' }}></div>
              Yükleniyor...
            </div>
          ) : decks.length === 0 ? (
            <div className="empty-state" style={{ border: "2px dashed var(--border)", boxShadow: "none", padding: '40px 20px', textAlign: 'center', borderRadius: '16px', background: 'rgba(255,255,255,0.3)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '10px', filter: 'drop-shadow(0 4px 10px rgba(155,138,235,0.3))' }}>✨</div>
              <p className="eyebrow" style={{ justifyContent: 'center' }}>Henüz deste yok</p>
              <h3>İlk desteni oluştur</h3>
              <p style={{ marginTop: '5px' }}>Öğrenmeye başlamak için PDF yükle veya manuel deste oluştur.</p>
            </div>
          ) : (
            <ul className="your-desks-list" style={{ position: 'relative', zIndex: 1 }}>
              {decks.slice(0, 8).map((deck) => (
                <li key={deck.id}>
                  <Link className="your-desks-item" to={`/decks/${deck.id}`}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(155, 138, 235, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: '0.9rem' }}>
                      {deck.source_type === "file" ? "📄" : "✏️"}
                    </div>
                    <span className="your-desks-name">{deck.title}</span>
                    <span className="your-desks-count" style={{ background: 'rgba(255,255,255,0.6)', padding: '2px 8px', borderRadius: '12px' }}>{deck.card_count} kart</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Right: Last Desk */}
        <section className="content-card dashboard-last-desk" style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Decorative background blob for the card */}
          <div style={{ position: 'absolute', bottom: '-80px', left: '-50px', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(180, 168, 239, 0.2), transparent)', borderRadius: '50%', pointerEvents: 'none' }}></div>
          
          <div style={{ marginBottom: "1.5rem", position: 'relative', zIndex: 1 }}>
            <p className="eyebrow">Son Çalışılan</p>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>⏱️</span> Last Desk
            </h2>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px', color: 'var(--text-soft)' }}>
              <div className="ai-status-dot" style={{ width: '12px', height: '12px' }}></div>
              Yükleniyor...
            </div>
          ) : !lastDeck ? (
            <div className="empty-state" style={{ border: "2px dashed var(--border)", boxShadow: "none", padding: '40px 20px', textAlign: 'center', borderRadius: '16px', background: 'rgba(255,255,255,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ fontSize: '3rem', marginBottom: '10px', filter: 'drop-shadow(0 4px 10px rgba(155,138,235,0.3))', opacity: 0.8 }}>📭</div>
              <p style={{ margin: 0, fontWeight: '500' }}>Henüz deste oluşturulmadı.</p>
            </div>
          ) : (
            <Link className="last-desk-card" to={`/decks/${lastDeck.id}`} style={{ position: 'relative', zIndex: 1, border: '1px solid rgba(155, 138, 235, 0.3)', background: 'linear-gradient(145deg, rgba(255,255,255,0.9), rgba(244,243,251,0.5))', boxShadow: '0 8px 24px rgba(155,138,235,0.08)' }}>
              <div className="last-desk-top">
                <div>
                  <p className="eyebrow" style={{ color: 'var(--accent)' }}>
                    {lastDeck.source_type === "file" ? "PDF'den oluşturuldu" : "Manuel deste"}
                  </p>
                  <h3 className="last-desk-title" style={{ fontSize: '1.3rem' }}>{lastDeck.title}</h3>
                </div>
                <span className="deck-progress" style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 4px 12px rgba(155,138,235,0.4)' }}>{formatDeckProgress(lastDeck.progress_percent)}</span>
              </div>
              <p className="deck-course" style={{ color: 'var(--text-soft)' }}>{formatDeckCourseTopic(lastDeck)}</p>
              <div className="deck-meta-row" style={{ marginTop: "1rem", borderTop: '1px solid rgba(155,138,235,0.15)', paddingTop: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>📅 {formatDeckDate(lastDeck.created_at)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(155,138,235,0.1)', padding: '4px 10px', borderRadius: '10px', color: 'var(--accent-hover)', fontWeight: '600' }}>🗂️ {lastDeck.card_count} kart</span>
              </div>
              <div className="last-desk-study-btn" style={{ marginTop: '1.5rem', boxShadow: '0 4px 16px rgba(155,138,235,0.25)' }}>
                Çalışmaya Başla →
              </div>
            </Link>
          )}
        </section>
      </div>

      {/* ── Modal ── */}
      {/* ── Modal Removed ── */}
    </>
  );
}
