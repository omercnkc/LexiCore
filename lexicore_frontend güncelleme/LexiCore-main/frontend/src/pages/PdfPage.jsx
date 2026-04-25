import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadFile, extractTerms, generateCards } from "../api/uploadsApi";
import { fetchDecks, createDeck } from "../api/decksApi";
import { useAuth } from "../context/AuthContext";

export default function PdfPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [file, setFile] = useState(null);
  const [uploadId, setUploadId] = useState(null);
  const [extractedTerms, setExtractedTerms] = useState([]);
  const [selectedTerms, setSelectedTerms] = useState(new Set());
  const [phase, setPhase] = useState("SETUP"); // SETUP, EXTRACTING, PREVIEW, GENERATING
  const [deckId, setDeckId] = useState(null);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");

  // Deck form state
  const [deckForm, setDeckForm] = useState({ title: "", course_name: "", topic_name: "" });

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  const handleUploadAndExtract = async (e) => {
    e.preventDefault();
    if (authLoading || !user) { setError("Oturumunuz yükleniyor."); return; }
    if (!file) { setError("Lütfen bir PDF dosyası seçin."); return; }
    if (file.type !== "application/pdf") { setError("Sadece PDF dosyaları desteklenmektedir."); return; }
    if (!deckForm.title.trim() || !deckForm.course_name.trim() || !deckForm.topic_name.trim()) {
      setError("Lütfen tüm deste bilgilerini doldurun."); return;
    }

    setPhase("EXTRACTING");
    setError("");

    try {
      setStatusText("Deste oluşturuluyor...");
      const deck = await createDeck(user, { title: deckForm.title.trim(), course_name: deckForm.course_name.trim(), topic_name: deckForm.topic_name.trim() });
      setDeckId(deck.id);

      setStatusText("Dosya yükleniyor...");
      const uploadRes = await uploadFile(user, file);
      setUploadId(uploadRes.id);

      setStatusText("AI dokümanı analiz ediyor...");
      const extractRes = await extractTerms(user, uploadRes.id);

      if (!extractRes.terms || extractRes.terms.length === 0) {
        setError("Bu dokümandan terim çıkarılamadı."); setPhase("SETUP"); return;
      }

      setExtractedTerms(extractRes.terms);
      setSelectedTerms(new Set(extractRes.terms.map((t) => t.term)));
      setPhase("PREVIEW");
      setStatusText("");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "İşlem başarısız.");
      setPhase("SETUP");
      setStatusText("");
    }
  };

  const toggleTerm = (term) => {
    const newKeys = new Set(selectedTerms);
    if (newKeys.has(term)) newKeys.delete(term); else newKeys.add(term);
    setSelectedTerms(newKeys);
  };

  const handleGenerateCards = async () => {
    if (!deckId) { setError("Deste bulunamadı."); return; }
    setPhase("GENERATING"); setError("");
    try {
      const res = await generateCards(user, uploadId, { upload_id: uploadId, deck_id: deckId, terms: Array.from(selectedTerms) });
      navigate(`/decks/${res.deck_id}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Kartlar oluşturulamadı.");
      setPhase("PREVIEW");
    }
  };

  return (
    <div className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">AI Analizi</p>
          <h1>PDF ile Kart Oluştur</h1>
        </div>
      </div>

      {phase === "SETUP" || phase === "EXTRACTING" ? (
        <form className="content-card deck-form" onSubmit={handleUploadAndExtract} style={{ maxWidth: "640px" }}>
          <h2>PDF Yükle</h2>
          {error ? <div className="form-error">{error}</div> : null}
          {statusText ? <div className="ai-status-banner"><span className="ai-status-dot"></span>{statusText}</div> : null}

          <label className="auth-field"><span>Deste Başlığı</span>
            <input name="title" value={deckForm.title} onChange={(e) => setDeckForm(p => ({ ...p, title: e.target.value }))} placeholder="Örn: Unit 2 Vocabulary" required />
          </label>
          <label className="auth-field"><span>Ders Adı</span>
            <input name="course_name" value={deckForm.course_name} onChange={(e) => setDeckForm(p => ({ ...p, course_name: e.target.value }))} placeholder="Örn: Biology" required />
          </label>
          <label className="auth-field"><span>Konu</span>
            <input name="topic_name" value={deckForm.topic_name} onChange={(e) => setDeckForm(p => ({ ...p, topic_name: e.target.value }))} placeholder="Örn: Cell Biology" required />
          </label>
          <label className="auth-field"><span>PDF Dosyası</span>
            <input type="file" accept="application/pdf" onChange={handleFileChange} disabled={phase !== "SETUP"} required />
          </label>

          <div className="form-actions">
            <button className="primary-button" disabled={phase !== "SETUP" || !file} type="submit">
              {phase === "SETUP" ? "Yükle & Analiz Et" : "Analiz ediliyor..."}
            </button>
          </div>
        </form>
      ) : (
        <div className="content-card deck-form" style={{ maxWidth: "640px" }}>
          {error ? <div className="form-error">{error}</div> : null}
          <h2>Terim Önizleme ({selectedTerms.size} seçili)</h2>
          <div className="terms-preview-list">
            {extractedTerms.map((termData, idx) => (
              <label key={idx} className={`term-preview-card ${selectedTerms.has(termData.term) ? "term-selected" : "term-deselected"}`}>
                <div className="term-preview-header">
                  <input type="checkbox" checked={selectedTerms.has(termData.term)} onChange={() => toggleTerm(termData.term)} />
                  <span className="term-preview-word">{termData.term}</span>
                  {termData.translation && <span className="term-preview-translation">{termData.translation}</span>}
                </div>
                {termData.example_sentence && <p className="term-preview-sentence">"{termData.example_sentence}"</p>}
                {termData.hint && <p className="term-preview-hint">💡 {termData.hint}</p>}
              </label>
            ))}
          </div>
          <div className="form-actions" style={{ marginTop: "1.5rem" }}>
            <button className="primary-button" disabled={phase === "GENERATING" || selectedTerms.size === 0} onClick={handleGenerateCards}>
              {phase === "GENERATING" ? "Oluşturuluyor..." : `${selectedTerms.size} Kart Oluştur`}
            </button>
            <button className="secondary-button" onClick={() => { setPhase("SETUP"); setFile(null); }} disabled={phase === "GENERATING"}>İptal</button>
          </div>
        </div>
      )}
    </div>
  );
}
