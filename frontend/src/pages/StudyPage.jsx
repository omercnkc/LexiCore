import { useEffect, useState, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { fetchStudyQueue, submitCardReview } from "../api/studyApi";
import { checkAnswer } from "../api/cardsApi";
import { useAuth } from "../context/AuthContext";

export default function StudyPage() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const answerInputRef = useRef(null);

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Interactive answer state
  const [userAnswer, setUserAnswer] = useState("");
  const [answerResult, setAnswerResult] = useState(null); // null = not checked yet
  const [checking, setChecking] = useState(false);
  const [phase, setPhase] = useState("INPUT"); // INPUT, RESULT

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

    async function loadQueue() {
      setLoading(true);
      try {
        const data = await fetchStudyQueue(user, deckId);
        if (isActive) {
          setQueue(data.items || []);
          setCurrentIndex(0);
          resetCardState();
          setError("");
        }
      } catch (err) {
        if (isActive) setError(err.message);
      } finally {
        if (isActive) setLoading(false);
      }
    }

    loadQueue();
    return () => { isActive = false; };
  }, [authLoading, deckId, user]);

  // Focus input when card changes
  useEffect(() => {
    if (phase === "INPUT" && answerInputRef.current) {
      answerInputRef.current.focus();
    }
  }, [currentIndex, phase]);

  const resetCardState = () => {
    setUserAnswer("");
    setAnswerResult(null);
    setPhase("INPUT");
    setChecking(false);
  };

  const currentCard = queue[currentIndex];

  const handleCheckAnswer = async () => {
    if (!currentCard || checking || !userAnswer.trim()) return;

    setChecking(true);
    try {
      const result = await checkAnswer(user, currentCard.id, userAnswer.trim());
      setAnswerResult(result);
      setPhase("RESULT");
    } catch (err) {
      setError("Failed to check answer: " + err.message);
    } finally {
      setChecking(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && phase === "INPUT" && userAnswer.trim()) {
      handleCheckAnswer();
    }
  };

  const handleRating = async (rating) => {
    if (authLoading || !user || !currentCard || submitting) return;

    setSubmitting(true);
    try {
      // Include answer data in the review record for analytics
      const answerData = answerResult
        ? {
            is_correct: answerResult.is_correct,
            similarity_score: answerResult.similarity_score,
            user_answer: userAnswer.trim(),
          }
        : {};

      await submitCardReview(user, currentCard.id, rating, answerData);

      // If rating was unknown, push the card to the end of the session queue to drill it until known
      if (rating === "unknown") {
        setQueue(prev => [...prev, currentCard]);
      }

      // Move to next card
      setCurrentIndex(prev => prev + 1);
      resetCardState();

    } catch (err) {
      alert("Failed to save review: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getSimilarityColor = (score) => {
    if (score >= 80) return "#10b981";
    if (score >= 50) return "#f59e0b";
    if (score >= 25) return "#f97316";
    return "#ef4444";
  };

  const getSimilarityLabel = (score) => {
    if (score >= 90) return "Mükemmel!";
    if (score >= 70) return "Çok yakın!";
    if (score >= 50) return "Kısmen doğru";
    if (score >= 25) return "Biraz yaklaştın";
    return "Yanlış";
  };

  if (error) {
    return (
      <div className="page-section">
        <div className="form-error">{error}</div>
        <Link to={`/decks/${deckId}`} className="secondary-button" style={{ display: "inline-block", marginTop: "1rem" }}>Back to Deck</Link>
      </div>
    );
  }

  if (loading) {
    return <div className="page-section">Loading your study queue...</div>;
  }

  // Session Completed
  if (currentIndex >= queue.length) {
    return (
      <div className="page-section" style={{ textAlign: "center", paddingTop: "4rem" }}>
        <h1 style={{ marginBottom: "1rem" }}>🎉 Tebrikler!</h1>
        <p style={{ color: "#555", marginBottom: "2rem" }}>Bu deste için tüm kartları tamamladınız.</p>
        <Link to={`/decks/${deckId}`} className="primary-button">
          Finish & Return
        </Link>
      </div>
    );
  }

  return (
    <div className="page-section study-container" style={{ maxWidth: "640px", margin: "0 auto" }}>
      <div className="study-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <Link to={`/decks/${deckId}`} className="secondary-button" style={{ padding: "0.4rem 0.8rem" }}>
          Exit Session
        </Link>
        <div className="progress-indicator" style={{ fontWeight: "600", color: "#555" }}>
          {currentIndex + 1} / {queue.length}
        </div>
      </div>

      {/* Flashcard */}
      <div className="flashcard" style={{
        background: "white",
        minHeight: "320px",
        borderRadius: "16px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        border: "1px solid #eaeaea",
        transition: "all 0.3s ease"
      }}>
        {/* Term display */}
        <h2 style={{ fontSize: "2.5rem", margin: "0 0 0.5rem" }}>{currentCard.translation}</h2>

        {/* Hint display */}
        {currentCard.hint && (
          <div className="hint-box">
            💡 {currentCard.hint}
          </div>
        )}

        {/* Answer Input Phase */}
        {phase === "INPUT" && (
          <div style={{ width: "100%", marginTop: "1.5rem" }}>
            <input
              ref={answerInputRef}
              type="text"
              className="answer-input"
              placeholder="İngilizce kelimeyi yazın..."
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={checking}
              autoComplete="off"
            />
            <button
              className="primary-button"
              style={{ marginTop: "1rem", width: "100%" }}
              onClick={handleCheckAnswer}
              disabled={checking || !userAnswer.trim()}
            >
              {checking ? "Kontrol ediliyor..." : "Kontrol Et"}
            </button>
          </div>
        )}

        {/* Result Phase */}
        {phase === "RESULT" && answerResult && (
          <div style={{ width: "100%", marginTop: "1.5rem" }}>
            {/* Similarity Badge */}
            <div className="similarity-badge" style={{
              background: answerResult.is_correct
                ? "linear-gradient(135deg, #d1fae5, #a7f3d0)"
                : "linear-gradient(135deg, #fee2e2, #fecaca)",
              borderColor: answerResult.is_correct ? "#10b981" : "#ef4444",
            }}>
              <div className="similarity-score" style={{ color: getSimilarityColor(answerResult.similarity_score) }}>
                %{Math.round(answerResult.similarity_score)}
              </div>
              <div className="similarity-label" style={{ color: getSimilarityColor(answerResult.similarity_score) }}>
                {getSimilarityLabel(answerResult.similarity_score)}
              </div>
            </div>

            {/* User's answer vs correct */}
            <div className="answer-comparison">
              <div className="answer-row">
                <span className="answer-label">Senin cevabın (İngilizce):</span>
                <span className={`answer-value ${answerResult.is_correct ? "answer-correct" : "answer-wrong"}`}>
                  {userAnswer}
                </span>
              </div>
              <div className="answer-row">
                <span className="answer-label">Doğru kelime:</span>
                <span className="answer-value answer-correct">{answerResult.correct_answer}</span>
              </div>
            </div>

            {/* AI Feedback */}
            {answerResult.feedback && (
              <div className="feedback-card">
                {answerResult.feedback}
              </div>
            )}

            {/* Example Sentence */}
            {currentCard.example_sentence && (
              <div style={{
                marginTop: "1rem",
                padding: "1rem",
                background: "#f8f9fa",
                borderRadius: "10px",
                fontStyle: "italic",
                color: "#555",
                fontSize: "0.95rem"
              }}>
                📖 "{currentCard.example_sentence}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rating buttons — only show after answer check */}
      {phase === "RESULT" && (
        <div className="rating-actions" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button
            disabled={submitting}
            onClick={() => handleRating("unknown")}
            className="rating-btn rating-unknown"
          >
            Bilmiyorum
          </button>
          <button
            disabled={submitting}
            onClick={() => handleRating("hard")}
            className="rating-btn rating-hard"
          >
            Zor
          </button>
          <button
            disabled={submitting}
            onClick={() => handleRating("medium")}
            className="rating-btn rating-medium"
          >
            Orta
          </button>
          <button
            disabled={submitting}
            onClick={() => handleRating("easy")}
            className="rating-btn rating-easy"
          >
            Kolay
          </button>
        </div>
      )}
    </div>
  );
}
