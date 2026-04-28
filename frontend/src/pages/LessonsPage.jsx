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

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    const courseName = form.course_name.trim();

    if (!courseName) {
      setFormError("Ders adı zorunludur.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const payload = {
        title: "Deste 1",
        course_name: courseName,
        topic_name: "Genel",
      };
      const deck = await createDeck(user, payload);
      setDecks((prev) => [deck, ...prev]);
      setForm({ course_name: "" });
      setShowForm(false);
      navigate(`/courses/${encodeURIComponent(courseName)}`);
    } catch (err) {
      if (err instanceof ApiAuthError) return;
      setFormError(err.message || "Ders oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCourse = async (courseName, courseDecks) => {
    if (!window.confirm(`"${courseName}" dersini silmek istediğinize emin misiniz? İçindeki tüm desteler ve kartlar silinecektir.`)) return;

    setDeletingId(courseName);
    try {
      for (const deck of courseDecks) {
         await deleteDeck(user, deck.id);
      }
      setDecks((prev) => prev.filter((d) => d.course_name !== courseName));
    } catch (err) {
      alert("Silinemedi: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Group by course_name
  const coursesMap = decks.reduce((acc, d) => {
    (acc[d.course_name] = acc[d.course_name] || []).push(d);
    return acc;
  }, {});
  
  // Sort courses by the most recently updated deck they contain
  const sortedCourses = Object.entries(coursesMap).map(([courseName, courseDecks]) => {
    const lastUpdate = new Date(Math.max(...courseDecks.map(d => new Date(d.updated_at).getTime())));
    return { courseName, courseDecks, lastUpdate, totalCards: courseDecks.reduce((sum, d) => sum + d.card_count, 0) };
  }).sort((a, b) => b.lastUpdate - a.lastUpdate);

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

      {/* New Course Form */}
      {showForm && (
        <form className="content-card deck-form" onSubmit={handleCreateCourse} style={{ maxWidth: "600px" }}>
          <div className="form-header">
            <h2>Yeni Ders Oluştur</h2>
          </div>

          {formError ? <div className="form-error">{formError}</div> : null}

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

      {!loading && !error && sortedCourses.length > 0 ? (
        <div className="courses-container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
          {sortedCourses.map(({ courseName, courseDecks, lastUpdate, totalCards }) => (
            <div className="deck-card" key={courseName} style={{ position: "relative" }}>
              <Link to={`/courses/${encodeURIComponent(courseName)}`} style={{ display: "contents" }}>
                <div className="deck-card-top">
                  <div>
                    <p className="eyebrow">{courseDecks.length} Deste</p>
                    <h3>📚 {courseName}</h3>
                  </div>
                </div>
                <div className="deck-meta-row" style={{ marginTop: "1rem" }}>
                  <span>Son çalışma: {formatDeckDate(lastUpdate.toISOString())}</span>
                  <span>{totalCards} kart</span>
                </div>
              </Link>
              <div style={{ position: "absolute", top: "16px", right: "16px", display: "flex", gap: "8px", zIndex: 10 }}>
                <button
                  className="lesson-delete-btn"
                  style={{ position: "relative", top: 0, right: 0 }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteCourse(courseName, courseDecks);
                  }}
                  disabled={deletingId === courseName}
                  title="Dersi sil"
                >
                  {deletingId === courseName ? "..." : "✕"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
