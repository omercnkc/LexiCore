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
  const [showModal, setShowModal] = useState(false);

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
            <button className="hero-btn hero-btn--secondary" onClick={() => setShowModal(true)}>
              <span>✏️</span> Manuel Oluştur
            </button>
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
        <section className="content-card dashboard-your-desks">
          <div className="section-heading" style={{ marginBottom: "1rem" }}>
            <div>
              <p className="eyebrow">Destelerim</p>
              <h2>Your Desks</h2>
            </div>
            {!loading && decks.length > 0 && (
              <Link className="secondary-button" to="/lessons" style={{ fontSize: "0.85rem", padding: "8px 14px" }}>
                Tümünü Gör
              </Link>
            )}
          </div>

          {loading ? (
            <p style={{ color: "var(--text-soft)" }}>Yükleniyor...</p>
          ) : decks.length === 0 ? (
            <div className="empty-state" style={{ border: "none", boxShadow: "none", padding: 0 }}>
              <p className="eyebrow">Henüz deste yok</p>
              <h3>İlk desteni oluştur</h3>
              <p>PDF yükle veya manuel oluştur.</p>
            </div>
          ) : (
            <ul className="your-desks-list">
              {decks.slice(0, 8).map((deck) => (
                <li key={deck.id}>
                  <Link className="your-desks-item" to={`/decks/${deck.id}`}>
                    <span className="your-desks-dot" />
                    <span className="your-desks-name">{deck.title}</span>
                    <span className="your-desks-count">{deck.card_count} kart</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Right: Last Desk */}
        <section className="content-card dashboard-last-desk">
          <div style={{ marginBottom: "1rem" }}>
            <p className="eyebrow">Son Deste</p>
            <h2>Last Desk</h2>
          </div>

          {loading ? (
            <p style={{ color: "var(--text-soft)" }}>Yükleniyor...</p>
          ) : !lastDeck ? (
            <div className="empty-state" style={{ border: "none", boxShadow: "none", padding: 0 }}>
              <p>Henüz deste oluşturulmadı.</p>
            </div>
          ) : (
            <Link className="last-desk-card" to={`/decks/${lastDeck.id}`}>
              <div className="last-desk-top">
                <div>
                  <p className="eyebrow">
                    {lastDeck.source_type === "file" ? "PDF'den oluşturuldu" : "Manuel deste"}
                  </p>
                  <h3 className="last-desk-title">{lastDeck.title}</h3>
                </div>
                <span className="deck-progress">{formatDeckProgress(lastDeck.progress_percent)}</span>
              </div>
              <p className="deck-course">{formatDeckCourseTopic(lastDeck)}</p>
              <div className="deck-meta-row" style={{ marginTop: "0.5rem" }}>
                <span>{formatDeckDate(lastDeck.created_at)}</span>
                <span>{lastDeck.card_count} kart</span>
              </div>
              <div className="last-desk-study-btn">
                Çalışmaya Başla →
              </div>
            </Link>
          )}
        </section>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <CreateDeckModal
          onClose={() => setShowModal(false)}
          onCreated={(deck) => {
            setDecks((prev) => [deck, ...prev]);
            navigate(`/decks/${deck.id}`);
          }}
        />
      )}
    </>
  );
}
