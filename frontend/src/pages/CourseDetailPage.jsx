import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { fetchDecks, createDeck, deleteDeck, updateDeck } from "../api/decksApi";
import { uploadFile, extractTerms, generateCards } from "../api/uploadsApi";
import { ApiAuthError } from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { formatDeckDate } from "../lib/deckUtils";

export default function CourseDetailPage() {
  const navigate = useNavigate();
  const { courseName } = useParams();
  const { user, loading: authLoading } = useAuth();
  
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [deletingId, setDeletingId] = useState(null);
  
  // New deck form states
  const [showForm, setShowForm] = useState(false);
  const [createStep, setCreateStep] = useState(1); // 1: Name, 2: Method, 3: PDF Upload, 4: Preview
  const [deckTitle, setDeckTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [statusText, setStatusText] = useState("");

  // PDF states
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploadId, setUploadId] = useState(null);
  const [extractedTerms, setExtractedTerms] = useState([]);
  const [selectedTerms, setSelectedTerms] = useState(new Set());

  // Edit deck form
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    let isActive = true;
    if (authLoading) { setLoading(true); return () => { isActive = false; }; }
    if (!user) { setLoading(false); return () => { isActive = false; }; }

    async function loadDecks() {
      setLoading(true);
      try {
        const data = await fetchDecks(user);
        if (isActive) {
          const courseDecks = (data.items || []).filter(d => d.course_name === courseName);
          setDecks(courseDecks);
          setError("");
        }
      } catch (err) {
        if (err instanceof ApiAuthError) return;
        if (isActive) setError(err.message || "Desteler yüklenemedi.");
      } finally {
        if (isActive) setLoading(false);
      }
    }
    loadDecks();
    return () => { isActive = false; };
  }, [authLoading, user, courseName]);

  const resetForm = () => {
    setShowForm(false);
    setCreateStep(1);
    setDeckTitle("");
    setFile(null);
    setExtractedTerms([]);
    setSelectedTerms(new Set());
    setFormError("");
    setStatusText("");
  };

  const handleStep1Submit = (e) => {
    e.preventDefault();
    if (!deckTitle.trim()) { setFormError("Deste adı zorunludur."); return; }
    setFormError("");
    setCreateStep(2);
  };

  const handleManualCreate = async () => {
    setSubmitting(true);
    setFormError("");
    try {
      const payload = { title: deckTitle.trim(), course_name: courseName, topic_name: "Genel" };
      const deck = await createDeck(user, payload);
      setDecks((prev) => [deck, ...prev]);
      resetForm();
      navigate(`/decks/${deck.id}`);
    } catch (err) {
      if (err instanceof ApiAuthError) return;
      setFormError(err.message || "Deste oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePdfExtract = async (e) => {
    e.preventDefault();
    if (!file) { setFormError("Lütfen bir PDF dosyası seçin."); return; }
    setSubmitting(true);
    setFormError("");
    try {
      setStatusText("Dosya yükleniyor...");
      const uploadRes = await uploadFile(user, file);
      setUploadId(uploadRes.id);

      setStatusText("AI dokümanı analiz ediyor...");
      const extractRes = await extractTerms(user, uploadRes.id);

      if (!extractRes.terms || extractRes.terms.length === 0) {
        setFormError("Bu dokümandan terim çıkarılamadı."); 
        setSubmitting(false);
        setStatusText("");
        return;
      }
      setExtractedTerms(extractRes.terms);
      setSelectedTerms(new Set(extractRes.terms.map((t) => t.term)));
      setCreateStep(4);
      setStatusText("");
    } catch (err) {
      setFormError(err.response?.data?.detail || err.message || "İşlem başarısız.");
      setStatusText("");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTerm = (term) => {
    const newKeys = new Set(selectedTerms);
    if (newKeys.has(term)) newKeys.delete(term); else newKeys.add(term);
    setSelectedTerms(newKeys);
  };

  const handleGenerateCards = async () => {
    setSubmitting(true);
    setFormError("");
    setStatusText("Deste ve kartlar oluşturuluyor...");
    try {
      // 1. Create the deck first
      const payload = { title: deckTitle.trim(), course_name: courseName, topic_name: "Genel" };
      const deck = await createDeck(user, payload);
      
      // 2. Generate cards for it
      await generateCards(user, uploadId, { upload_id: uploadId, deck_id: deck.id, terms: Array.from(selectedTerms) });
      
      // Update local state
      setDecks((prev) => [{...deck, card_count: selectedTerms.size}, ...prev]);
      resetForm();
    } catch (err) {
      setFormError(err.response?.data?.detail || err.message || "Kartlar oluşturulamadı.");
    } finally {
      setSubmitting(false);
      setStatusText("");
    }
  };

  const handleDelete = async (deckId, title) => {
    if (!window.confirm(`"${title}" destesini silmek istediğinize emin misiniz?`)) return;
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

  const handleUpdate = async (deckId) => {
    if (!editTitle.trim()) { setEditingId(null); return; }
    try {
      const updated = await updateDeck(user, deckId, { title: editTitle.trim() });
      setDecks((prev) => prev.map(d => d.id === deckId ? { ...d, title: updated.title } : d));
      setEditingId(null);
    } catch (err) {
      alert("Güncellenemedi: " + err.message);
    }
  };

  return (
    <section className="page-section">
      <div className="study-header" style={{ marginBottom: "1.5rem" }}>
        <Link to="/lessons" className="secondary-button" style={{ padding: "0.4rem 0.8rem", display: "inline-block" }}>
          ← Derslere Dön
        </Link>
      </div>
      
      <div className="section-heading">
        <div>
          <p className="eyebrow">DERS DETAYI</p>
          <h1>📚 {courseName}</h1>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="secondary-button" onClick={() => navigate(`/decks/course-${encodeURIComponent(courseName)}/study`)}>
            Tüm Derse Çalış
          </button>
          <button className="primary-button" onClick={() => { if(showForm) resetForm(); else setShowForm(true); }}>
            {showForm ? "İptal" : "+ Yeni Deste"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="content-card deck-form" style={{ maxWidth: "640px" }}>
          {formError ? <div className="form-error">{formError}</div> : null}
          {statusText ? <div className="ai-status-banner" style={{ margin: "0 0 1rem 0" }}><span className="ai-status-dot"></span>{statusText}</div> : null}

          {createStep === 1 && (
            <form onSubmit={handleStep1Submit}>
              <div className="form-header"><h2>1. Desteye İsim Verin</h2></div>
              <label className="auth-field">
                <span>Deste Adı</span>
                <input value={deckTitle} onChange={(e) => setDeckTitle(e.target.value)} placeholder="Örn: Bölüm 1 - Terimler" maxLength={120} required autoFocus />
              </label>
              <div className="form-actions"><button className="primary-button" type="submit">İleri</button></div>
            </form>
          )}

          {createStep === 2 && (
            <div>
              <div className="form-header"><h2>2. Oluşturma Yöntemi Seçin</h2></div>
              <p style={{ marginBottom: "1rem", color: "var(--text-soft)" }}>Desteyi nasıl oluşturmak istersiniz?</p>
              <div style={{ display: "flex", gap: "1rem" }}>
                <button className="primary-button" style={{ flex: 1, padding: "1rem" }} onClick={() => setCreateStep(3)}>📄 PDF'den Analiz Et</button>
                <button className="secondary-button" style={{ flex: 1, padding: "1rem" }} onClick={handleManualCreate} disabled={submitting}>✏️ Manuel Olarak Yaz</button>
              </div>
            </div>
          )}

          {createStep === 3 && (
            <form onSubmit={handlePdfExtract}>
              <div className="form-header"><h2>3. PDF Yükle</h2></div>
              <p style={{ marginBottom: "1rem", color: "var(--text-soft)" }}>Seçtiğiniz PDF analiz edilecek ve terimler listelenecek.</p>
              <div style={{ border: '1.5px dashed var(--accent-light)', borderRadius: '12px', padding: '24px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--surface-muted)', marginBottom: '1rem' }}>
                <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} ref={fileInputRef} style={{ display: 'none' }} />
                <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()} disabled={submitting}>Dosya Seç</button>
                <span style={{ fontSize: '0.9rem', color: file ? 'var(--text)' : 'var(--text-soft)' }}>{file ? file.name : 'Dosya seçilmedi'}</span>
              </div>
              <div className="form-actions">
                <button className="primary-button" disabled={submitting || !file} type="submit">{submitting ? "İşleniyor..." : "Analiz Et"}</button>
                <button type="button" className="secondary-button" onClick={() => setCreateStep(2)} disabled={submitting}>Geri</button>
              </div>
            </form>
          )}

          {createStep === 4 && (
            <div>
              <div className="form-header"><h2>4. Terimleri Seçin ({selectedTerms.size} seçili)</h2></div>
              <div className="terms-preview-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem', padding: '5px' }}>
                {extractedTerms.map((termData, idx) => (
                  <label key={idx} className={`term-preview-card ${selectedTerms.has(termData.term) ? "term-selected" : "term-deselected"}`} style={{ padding: '10px', margin: 0 }}>
                    <div className="term-preview-header" style={{ marginBottom: 0 }}>
                      <input type="checkbox" checked={selectedTerms.has(termData.term)} onChange={() => toggleTerm(termData.term)} />
                      <span className="term-preview-word" style={{ fontSize: '0.95rem' }}>{termData.term}</span>
                    </div>
                  </label>
                ))}
              </div>
              <div className="form-actions">
                <button className="primary-button" disabled={submitting || selectedTerms.size === 0} onClick={handleGenerateCards}>{submitting ? "Oluşturuluyor..." : "Desteyi Oluştur"}</button>
                <button type="button" className="secondary-button" onClick={() => setCreateStep(3)} disabled={submitting}>Geri</button>
              </div>
            </div>
          )}
        </div>
      )}

      {error ? <div className="form-error">{error}</div> : null}
      {loading ? <div className="content-card">Desteler yükleniyor...</div> : null}

      {!loading && !error && decks.length === 0 && !showForm ? (
        <div className="empty-state">
          <p className="eyebrow">Deste yok</p>
          <h3>İlk destenizi oluşturun</h3>
          <button className="primary-button" onClick={() => setShowForm(true)}>
            + Yeni Deste
          </button>
        </div>
      ) : null}

      {!loading && !error && decks.length > 0 ? (
        <div className="deck-grid">
          {decks.map((deck) => (
            <div className="deck-card" key={deck.id} style={{ position: "relative" }}>
              {editingId === deck.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "10px" }}>
                  <input 
                    value={editTitle} 
                    onChange={e => setEditTitle(e.target.value)} 
                    className="auth-field input"
                    style={{ padding: "5px" }}
                    autoFocus
                  />
                  <div style={{ display: "flex", gap: "5px" }}>
                    <button className="primary-button" style={{ padding: "5px", flex: 1 }} onClick={() => handleUpdate(deck.id)}>Kaydet</button>
                    <button className="secondary-button" style={{ padding: "5px", flex: 1 }} onClick={() => setEditingId(null)}>İptal</button>
                  </div>
                </div>
              ) : (
                <>
                  <Link to={`/decks/${deck.id}`} style={{ display: "contents" }}>
                    <div className="deck-card-top">
                      <div>
                        <p className="eyebrow">
                          {deck.source_type === "file" ? "PDF" : "Manuel"}
                        </p>
                        <h3>{deck.title}</h3>
                      </div>
                    </div>
                    <p className="deck-course">{deck.topic_name}</p>
                    <div className="deck-meta-row">
                      <span>{formatDeckDate(deck.created_at)}</span>
                      <span>{deck.card_count} kart</span>
                    </div>
                  </Link>
                  <div style={{ position: "absolute", top: "16px", right: "16px", display: "flex", gap: "8px", zIndex: 10 }}>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditTitle(deck.title);
                        setEditingId(deck.id);
                      }}
                      title="Adı düzenle"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }}
                    >
                      ✏️
                    </button>
                    <button
                      className="lesson-delete-btn"
                      style={{ position: "relative", top: 0, right: 0 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(deck.id, deck.title);
                      }}
                      disabled={deletingId === deck.id}
                      title="Desteyi sil"
                    >
                      {deletingId === deck.id ? "..." : "✕"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
