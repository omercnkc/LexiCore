import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { fetchDecks, createDeck, deleteDeck } from "../api/decksApi";
import { ApiAuthError } from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { formatDeckCourseTopic, formatDeckDate } from "../lib/deckUtils";

export default function LessonsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New deck form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", course_name: "", topic_name: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete state
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let isActive = true;

    if (authLoading) {
      setLoading(true);
      return () => { isActive = false; };
    }

    if (!user) {
      setLoading(false);
      return () => { isActive = false; };
    }

    async function loadDecks() {
      setLoading(true);
      try {
        const data = await fetchDecks(user);
        if (isActive) {
          setDecks(data.items || []);
          setError("");
        }
      } catch (err) {
        if (err instanceof ApiAuthError) return;
        if (isActive) setError(err.message || "Unable to load lessons.");
      } finally {
        if (isActive) setLoading(false);
      }
    }

    loadDecks();
    return () => { isActive = false; };
  }, [authLoading, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateDeck = async (e) => {
    e.preventDefault();
    const payload = {
      title: form.title.trim(),
      course_name: form.course_name.trim(),
      topic_name: form.topic_name.trim(),
    };

    if (!payload.title || !payload.course_name || !payload.topic_name) {
      setFormError("Tüm alanlar zorunludur.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const deck = await createDeck(user, payload);
      setDecks((prev) => [deck, ...prev]);
      setForm({ title: "", course_name: "", topic_name: "" });
      setShowForm(false);
    } catch (err) {
      if (err instanceof ApiAuthError) return;
      setFormError(err.message || "Ders oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (deckId, deckTitle) => {
    if (!window.confirm(`"${deckTitle}" dersini silmek istediğinize emin misiniz? Tüm kartlar da silinecektir.`)) return;

    setDeletingId(deckId);
    try {
      await deleteDeck(user, deckId);
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
    } catch (err) {
      alert("Silinemedi: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Derslerim</p>
          <h1>Lessons</h1>
        </div>
        <button
          className="primary-button"
          onClick={() => { setShowForm(!showForm); setFormError(""); }}
        >
          {showForm ? "İptal" : "+ Yeni Ders"}
        </button>
      </div>

      {/* New Deck Form */}
      {showForm && (
        <form className="content-card deck-form" onSubmit={handleCreateDeck} style={{ maxWidth: "600px" }}>
          <div className="form-header">
            <h2>Yeni Ders Oluştur</h2>
          </div>

          {formError ? <div className="form-error">{formError}</div> : null}

          <label className="auth-field">
            <span>Başlık</span>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Örn: Unit 2 Pathogens"
              maxLength={120}
              required
            />
          </label>
          <label className="auth-field">
            <span>Ders Adı</span>
            <input
              name="course_name"
              value={form.course_name}
              onChange={handleChange}
              placeholder="Örn: Microbiology"
              maxLength={120}
              required
            />
          </label>
          <label className="auth-field">
            <span>Konu</span>
            <input
              name="topic_name"
              value={form.topic_name}
              onChange={handleChange}
              placeholder="Örn: Bacteria"
              maxLength={120}
              required
            />
          </label>
          <div className="form-actions">
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? "Oluşturuluyor..." : "Oluştur"}
            </button>
          </div>
        </form>
      )}

      {error ? <div className="form-error">{error}</div> : null}
      {loading ? <div className="content-card">Dersler yükleniyor...</div> : null}

      {!loading && !error && decks.length === 0 && !showForm ? (
        <div className="empty-state">
          <p className="eyebrow">Henüz ders yok</p>
          <h3>İlk dersinizi oluşturun</h3>
          <p>Başlık, ders adı ve konu girerek başlayın.</p>
          <button className="primary-button" onClick={() => setShowForm(true)}>
            + Yeni Ders
          </button>
        </div>
      ) : null}

      {!loading && !error && decks.length > 0 ? (
        <div className="deck-grid">
          {decks.map((deck) => (
            <div className="deck-card" key={deck.id} style={{ position: "relative" }}>
              <Link to={`/decks/${deck.id}`} style={{ display: "contents" }}>
                <div className="deck-card-top">
                  <div>
                    <p className="eyebrow">
                      {deck.source_type === "file" ? "PDF'den oluşturuldu" : "Manuel ders"}
                    </p>
                    <h3>{deck.title}</h3>
                  </div>
                </div>
                <p className="deck-course">{formatDeckCourseTopic(deck)}</p>
                <div className="deck-meta-row">
                  <span>{formatDeckDate(deck.created_at)}</span>
                  <span>{deck.card_count} kart</span>
                </div>
              </Link>
              <button
                className="lesson-delete-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete(deck.id, deck.title);
                }}
                disabled={deletingId === deck.id}
                title="Dersi sil"
              >
                {deletingId === deck.id ? "..." : "✕"}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
