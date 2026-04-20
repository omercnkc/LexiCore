import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { uploadFile, extractTerms, generateCards } from "../api/uploadsApi";
import { useAuth } from "../context/AuthContext";

export default function UploadPage() {
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

  // Deck State
  const [deckForm, setDeckForm] = useState({
    title: "",
    course_name: "",
    topic_name: "",
  });

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadAndExtract = async (e) => {
    e.preventDefault();
    if (authLoading || !user) {
      setError("Your session is still loading. Please try again.");
      return;
    }

    if (!file) {
      setError("Please select a file first.");
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Only PDF files are supported currently.");
      return;
    }

    setPhase("EXTRACTING");
    setError("");

    try {
      setStatusText("Uploading file...");
      const uploadRes = await uploadFile(user, file);
      setUploadId(uploadRes.id);

      setStatusText("Extracting candidate terms...");
      const extractRes = await extractTerms(user, uploadRes.id);

      if (!extractRes.terms || extractRes.terms.length === 0) {
        setError("No terminology could be extracted from this document.");
        setPhase("UPLOAD");
        return;
      }

      setExtractedTerms(extractRes.terms.map((t) => t.term));
      setSelectedTerms(new Set(extractRes.terms.map((t) => t.term)));
      setPhase("PREVIEW");
      setStatusText("");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to process file.");
      setPhase("UPLOAD");
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

  const handleDeckFormChange = (event) => {
    const { name, value } = event.target;
    setDeckForm((current) => ({ ...current, [name]: value }));
  };

  const handleGenerateCards = async () => {
    if (authLoading || !user) {
      setError("Your session is still loading. Please try again.");
      return;
    }

    if (selectedTerms.size === 0) {
      setError("Please select at least one term.");
      return;
    }

    if (!deckForm.title.trim() || !deckForm.course_name.trim() || !deckForm.topic_name.trim()) {
      setError("Title, course name, and topic name are required.");
      return;
    }

    setPhase("GENERATING");
    setError("");

    try {
      const payload = {
        upload_id: uploadId,
        deck_title: deckForm.title.trim(),
        course_name: deckForm.course_name.trim(),
        topic_name: deckForm.topic_name.trim(),
        terms: Array.from(selectedTerms),
      };

      const res = await generateCards(user, uploadId, payload);
      if (!res?.deck_id) {
        throw new Error("The backend did not return a generated deck.");
      }

      navigate(`/decks/${res.deck_id}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to generate cards.");
      setPhase("PREVIEW");
    }
  };

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Smart Creation</p>
          <h1>Upload File</h1>
        </div>
        <Link className="secondary-button" to="/dashboard">
          Back to dashboard
        </Link>
      </div>

      <div className="form-shell">
        {phase === "UPLOAD" || phase === "EXTRACTING" ? (
          <>
            <div className="content-card content-card-muted">
              <p className="eyebrow">Source Material</p>
              <h2>Provide your PDF</h2>
              <p>
                LexiCore will extract likely academic terms from your document. You will be able to
                preview and select the terms before generating flashcards.
              </p>
            </div>

            <form className="content-card deck-form" onSubmit={handleUploadAndExtract}>
              <div className="form-header">
                <h2>Upload details</h2>
              </div>

              {error ? <div className="form-error">{error}</div> : null}
              {statusText ? <div style={{ marginBottom: "1rem", color: "#6366f1" }}>{statusText}</div> : null}

              <label className="auth-field">
                <span>File (PDF only)</span>
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
                  {phase === "UPLOAD" ? "Upload & Extract" : "Processing..."}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="content-card content-card-muted">
              <p className="eyebrow">Preview</p>
              <h2>Select Terms & Setup Deck</h2>
              <p>
                Review the {extractedTerms.length} candidate terms found. Uncheck any terms you do not wish to study. 
                Translations will be initialized as "TBD" for you to fill in.
              </p>
            </div>
            
            <div className="content-card deck-form">
              {error ? <div className="form-error">{error}</div> : null}

              <div className="form-header">
                <h2>Deck Information</h2>
              </div>
              <label className="auth-field">
                <span>Title</span>
                <input
                  name="title"
                  value={deckForm.title}
                  onChange={handleDeckFormChange}
                  placeholder="Ex: Unit 2 Pathogens"
                  required
                />
              </label>
              <label className="auth-field">
                <span>Course name</span>
                <input
                  name="course_name"
                  value={deckForm.course_name}
                  onChange={handleDeckFormChange}
                  placeholder="Ex: Microbiology"
                  required
                />
              </label>
              <label className="auth-field">
                <span>Topic name</span>
                <input
                  name="topic_name"
                  value={deckForm.topic_name}
                  onChange={handleDeckFormChange}
                  placeholder="Ex: Bacteria"
                  required
                />
              </label>

              <div className="form-header" style={{ marginTop: "2rem" }}>
                <h2>Terms Preview ({selectedTerms.size} selected)</h2>
              </div>
              <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #e2e8f0", padding: "1rem", borderRadius: "8px" }}>
                {extractedTerms.map((term, idx) => (
                  <label key={idx} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selectedTerms.has(term)}
                      onChange={() => toggleTerm(term)}
                    />
                    <span>{term}</span>
                  </label>
                ))}
              </div>

              <div className="form-actions" style={{ marginTop: "2rem" }}>
                <button
                  className="primary-button"
                  disabled={authLoading || phase === "GENERATING" || selectedTerms.size === 0}
                  onClick={handleGenerateCards}
                >
                  {phase === "GENERATING" ? "Generating..." : "Generate Deck"}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => { setPhase("UPLOAD"); setFile(null); }}
                  disabled={phase === "GENERATING"}
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
