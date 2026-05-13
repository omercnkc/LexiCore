import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { uploadFile, extractTerms, generateCards } from "../api/uploadsApi";
import { fetchDecks, createDeck } from "../api/decksApi";
import { useAuth } from "../context/AuthContext";

export default function PdfPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [uploadId, setUploadId] = useState(null);
  const [extractedTerms, setExtractedTerms] = useState([]);
  const [selectedTerms, setSelectedTerms] = useState(new Set());
  const [phase, setPhase] = useState("SETUP"); // SETUP, EXTRACTING, PREVIEW, GENERATING
  const [deckId, setDeckId] = useState(null);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");
  const [decks, setDecks] = useState([]);

  useEffect(() => {
    if (user) {
      loadDecks();
    }
  }, [user]);

  const loadDecks = async () => {
    try {
      const data = await fetchDecks(user);
      // Let's filter decks that look like PDF uploads if we want, or just show all decks.
      // We'll show all decks for now or the ones named "PDF'ler".
      setDecks((data.items || []).filter(d => d.course_name === "PDF'ler" || d.topic_name === "Genel"));
    } catch (err) {
      console.error(err);
    }
  };

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

    setPhase("EXTRACTING");
    setError("");

    try {
      setStatusText("Deste oluşturuluyor...");
      const title = file.name.replace('.pdf', '');
      const deck = await createDeck(user, { title: title, course_name: "PDF'ler", topic_name: "Genel" });
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
      navigate(`/decks/${res.deck_id}/study`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Kartlar oluşturulamadı.");
      setPhase("PREVIEW");
    }
  };

  const handleBoxClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="page-section">
      <div className="section-heading" style={{ marginBottom: '10px' }}>
        <div>
          <p className="eyebrow">DOKÜMAN</p>
          <h1>PDF Yükle</h1>
        </div>
      </div>

      {phase === "SETUP" || phase === "EXTRACTING" ? (
        <>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {/* Left Box */}
            <div className="content-card" style={{ flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Dosya Yükleme (PDF)</h2>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-soft)', flex: '1' }}>
                LexiCore, belgenizden muhtemel akademik terimleri çıkaracak. Flashkartlar oluşturmadan önce terimleri önizleyip seçebilirsiniz.
              </p>
              <button 
                type="button" 
                className="primary-button" 
                onClick={handleBoxClick}
                disabled={phase !== "SETUP"}
                style={{ alignSelf: 'flex-start', padding: '10px 24px' }}>
                PDF Yükle
              </button>
            </div>

            {/* Right Box */}
            <form className="content-card deck-form" onSubmit={handleUploadAndExtract} style={{ flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Dosya (PDF)</h2>
              {error ? <div className="form-error">{error}</div> : null}
              {statusText ? <div className="ai-status-banner" style={{ margin: 0 }}><span className="ai-status-dot"></span>{statusText}</div> : null}

              <div 
                style={{ 
                  border: '1.5px dashed var(--accent-light)', 
                  borderRadius: '12px', 
                  padding: '24px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  background: 'var(--surface-muted)' 
                }}>
                <input 
                  type="file" 
                  accept="application/pdf" 
                  onChange={handleFileChange} 
                  disabled={phase !== "SETUP"} 
                  required 
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  id="file-upload"
                />
                <button 
                  type="button" 
                  className="secondary-button" 
                  onClick={handleBoxClick}
                  disabled={phase !== "SETUP"}
                >
                  dosya seç
                </button>
                <span style={{ fontSize: '0.9rem', color: file ? 'var(--text)' : 'var(--text-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {file ? file.name : 'Dosya seçilmedi'}
                </span>
              </div>

              <div className="form-actions" style={{ marginTop: 'auto' }}>
                <button 
                  className="primary-button" 
                  disabled={phase !== "SETUP" || !file} 
                  type="submit" 
                  style={{ width: '100%', padding: '12px', background: 'transparent', color: 'var(--text)', border: '1.5px solid var(--border)' }}>
                  {phase === "SETUP" ? "Yükle ve Çıkar" : "İşleniyor..."}
                </button>
              </div>
            </form>
          </div>

          <div style={{ marginTop: '30px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '16px', borderBottom: '2px solid var(--border)', paddingBottom: '8px' }}>Yüklenen PDF'ler</h2>
            <div className="content-card" style={{ padding: '0', overflow: 'hidden' }}>
              {decks.length === 0 ? (
                <div className="empty-state" style={{ margin: '20px', border: "2px dashed var(--border)", boxShadow: "none", padding: '40px 20px', textAlign: 'center', borderRadius: '16px', background: 'rgba(255,255,255,0.3)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '10px', filter: 'drop-shadow(0 4px 10px rgba(155,138,235,0.3))', opacity: 0.8 }}>📁</div>
                  <p className="eyebrow" style={{ justifyContent: 'center' }}>Liste Boş</p>
                  <h3 style={{ fontSize: '1.2rem', margin: '5px 0' }}>Henüz bir PDF yüklemediniz</h3>
                  <p style={{ marginTop: '5px', fontSize: '0.9rem' }}>Yüklediğiniz PDF dokümanları burada listelenecektir.</p>
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: '0', padding: '0' }}>
                  {decks.map(deck => (
                    <li key={deck.id} style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="your-desks-dot"></div>
                      <div style={{ flex: '1', fontWeight: '500' }}>{deck.title}</div>
                      <button className="secondary-button" onClick={() => navigate(`/decks/${deck.id}`)} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Görüntüle</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="content-card deck-form" style={{ maxWidth: "640px" }}>
          {error ? <div className="form-error">{error}</div> : null}
          <h2>Terim Önizleme ({selectedTerms.size} seçili)</h2>
          <div className="terms-preview-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
            {extractedTerms.map((termData, idx) => (
              <label key={idx} className={`term-preview-card ${selectedTerms.has(termData.term) ? "term-selected" : "term-deselected"}`} style={{ padding: '10px' }}>
                <div className="term-preview-header" style={{ marginBottom: 0 }}>
                  <input type="checkbox" checked={selectedTerms.has(termData.term)} onChange={() => toggleTerm(termData.term)} />
                  <span className="term-preview-word" style={{ fontSize: '1rem' }}>{termData.term}</span>
                </div>
              </label>
            ))}
          </div>
          <div className="form-actions" style={{ marginTop: "1.5rem" }}>
            <button className="primary-button" disabled={phase === "GENERATING" || selectedTerms.size === 0} onClick={handleGenerateCards}>
              {phase === "GENERATING" ? "AI Kartları Hazırlıyor..." : "Desteyi Oluştur & Çalış"}
            </button>
            <button className="secondary-button" onClick={() => { setPhase("SETUP"); setFile(null); }} disabled={phase === "GENERATING"}>İptal</button>
          </div>
        </div>
      )}
    </div>
  );
}
