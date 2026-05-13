import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { uploadFile, extractTerms, generateCards } from "../api/uploadsApi";
import { useAuth } from "../context/AuthContext";

export default function UploadPage() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Process States
  const [file, setFile] = useState(null);
  const [uploadId, setUploadId] = useState(null);
  const [extractedTerms, setExtractedTerms] = useState([]);
  const [selectedTerms, setSelectedTerms] = useState(new Set());
  const [phase, setPhase] = useState("UPLOAD"); // UPLOAD, EXTRACTING, PREVIEW, GENERATING

  // Feedback State
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  const handleUploadAndExtract = async (e) => {
    e.preventDefault();
    if (authLoading || !user) {
      setError("Oturumunuz yükleniyor, lütfen tekrar deneyin.");
      return;
    }

    if (!file) {
      setError("Lütfen bir dosya seçin.");
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Şu anda sadece PDF dosyaları desteklenmektedir.");
      return;
    }

    setPhase("EXTRACTING");
    setError("");

    try {
      setStatusText("Dosya yükleniyor...");
      const uploadRes = await uploadFile(user, file);
      setUploadId(uploadRes.id);

      setStatusText("AI dokümanınızı analiz ediyor — bu biraz zaman alabilir...");
      const extractRes = await extractTerms(user, uploadRes.id);

      if (!extractRes.terms || extractRes.terms.length === 0) {
        setError("Bu dokümandan terim çıkarılamadı.");
        setPhase("UPLOAD");
        return;
      }

      setExtractedTerms(extractRes.terms);
      setSelectedTerms(new Set(extractRes.terms.map((t) => t.term)));
      setPhase("PREVIEW");
      setStatusText("");
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Dosya işlenemedi.";
      setError(detail);
      setPhase("UPLOAD");
      setStatusText("");
    }
  };

  const toggleTerm = (term) => {
    const newKeys = new Set(selectedTerms);
    if (newKeys.has(term)) {
      newKeys.delete(term);
    } else {
      newKeys.add(term);
    }
    setSelectedTerms(newKeys);
  };

  const handleGenerateCards = async () => {
    if (authLoading || !user) {
      setError("Oturumunuz yükleniyor, lütfen tekrar deneyin.");
      return;
    }

    if (selectedTerms.size === 0) {
      setError("Lütfen en az bir terim seçin.");
      return;
    }

    setPhase("GENERATING");
    setError("");

    try {
      const payload = {
        upload_id: uploadId,
        deck_id: deckId,
        terms: Array.from(selectedTerms),
      };

      const res = await generateCards(user, uploadId, payload);
      if (!res?.deck_id) {
        throw new Error("Backend deste ID döndürmedi.");
      }

      navigate(`/decks/${res.deck_id}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Kartlar oluşturulamadı.");
      setPhase("PREVIEW");
    }
  };

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">AI Analizi</p>
          <h1>PDF ile Kart Oluştur</h1>
        </div>
        <Link className="secondary-button" to={`/decks/${deckId}`}>
          Derse Dön
        </Link>
      </div>

      <div className="form-shell">
        {phase === "UPLOAD" || phase === "EXTRACTING" ? (
          <>
            <div className="content-card content-card-muted">
              <p className="eyebrow">Kaynak Materyal</p>
              <h2>PDF Yükleyin</h2>
              <p>
                LexiCore, AI kullanarak dokümanınızdaki en önemli akademik terimleri çıkaracak ve
                çeviri, örnek cümle ve ipucu içeren flashcard'lar oluşturacak.
              </p>
            </div>

            <form className="content-card deck-form" onSubmit={handleUploadAndExtract}>
              <div className="form-header">
                <h2>Dosya Yükleme</h2>
              </div>

              {error ? <div className="form-error">{error}</div> : null}
              {statusText ? (
                <div className="ai-status-banner">
                  <span className="ai-status-dot"></span>
                  {statusText}
                </div>
              ) : null}

              <label className="auth-field">
                <span>Dosya (sadece PDF)</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  disabled={phase !== "UPLOAD"}
                  required
                />
              </label>

              <div className="form-actions">
                <button className="primary-button" disabled={phase !== "UPLOAD" || !file} type="submit">
                  {phase === "UPLOAD" ? "Yükle & AI ile Analiz Et" : "Analiz ediliyor..."}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="content-card content-card-muted">
              <p className="eyebrow">AI Önizleme</p>
              <h2>AI Tarafından Bulunan Terimler</h2>
              <p>
                Gemini AI {extractedTerms.length} önemli terim buldu. Her terim Türkçe çeviri,
                örnek cümle ve ipucu içerir.
              </p>
            </div>

            <div className="content-card deck-form">
              {error ? <div className="form-error">{error}</div> : null}

              <div className="form-header">
                <h2>Terim Önizleme ({selectedTerms.size} seçili)</h2>
              </div>

              <div className="terms-preview-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                {extractedTerms.map((termData, idx) => (
                  <label
                    key={idx}
                    className={`term-preview-card ${selectedTerms.has(termData.term) ? "term-selected" : "term-deselected"}`}
                    style={{ padding: '10px' }}
                  >
                    <div className="term-preview-header" style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={selectedTerms.has(termData.term)}
                        onChange={() => toggleTerm(termData.term)}
                      />
                      <span className="term-preview-word" style={{ fontSize: '1rem' }}>{termData.term}</span>
                    </div>
                  </label>
                ))}
              </div>

              <div className="form-actions" style={{ marginTop: "2rem" }}>
                <button
                  className="primary-button"
                  disabled={authLoading || phase === "GENERATING" || selectedTerms.size === 0}
                  onClick={handleGenerateCards}
                >
                  {phase === "GENERATING" ? "AI Kartları Hazırlıyor..." : `${selectedTerms.size} Kart Oluştur`}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => { setPhase("UPLOAD"); setFile(null); }}
                  disabled={phase === "GENERATING"}
                >
                  İptal
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
