import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { fetchStudyQueue, submitCardReview } from "../api/studyApi";
import { useAuth } from "../context/AuthContext";

export default function StudyPage() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
          setIsRevealed(false);
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

  const handleReveal = () => setIsRevealed(true);

  const handleFocusAction = (e) => {
    // optional keyboard shortcuts could go here
  };

  const currentCard = queue[currentIndex];

  const handleRating = async (rating) => {
    if (authLoading || !user || !currentCard || submitting) return;
    
    setSubmitting(true);
    try {
      await submitCardReview(user, currentCard.id, rating);
      
      // If rating was unknown, push the card to the end of the session queue to drill it until known
      if (rating === "unknown") {
        setQueue(prev => [...prev, currentCard]);
      }
      
      // Move to next card
      setCurrentIndex(prev => prev + 1);
      setIsRevealed(false);
      
    } catch (err) {
      alert("Failed to save review: " + err.message);
    } finally {
      setSubmitting(false);
    }
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
        <h1 style={{ marginBottom: "1rem" }}>🎉 All Done!</h1>
        <p style={{ color: "#555", marginBottom: "2rem" }}>You have completed all due cards for this deck.</p>
        <Link to={`/decks/${deckId}`} className="primary-button">
          Finish & Return
        </Link>
      </div>
    );
  }

  return (
    <div className="page-section study-container" style={{ maxWidth: "600px", margin: "0 auto" }}>
      <div className="study-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <Link to={`/decks/${deckId}`} className="secondary-button" style={{ padding: "0.4rem 0.8rem" }}>
          Exit Session
        </Link>
        <div className="progress-indicator" style={{ fontWeight: "600", color: "#555" }}>
          {currentIndex + 1} / {queue.length}
        </div>
      </div>

      <div className="flashcard" onClick={!isRevealed ? handleReveal : null} style={{
        background: "white", 
        minHeight: "350px", 
        borderRadius: "12px", 
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)", 
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        cursor: !isRevealed ? "pointer" : "default",
        border: "1px solid #eaeaea",
        transition: "all 0.3s ease"
      }}>
        
        <div className="card-front" style={{ marginBottom: isRevealed ? "2rem" : "0" }}>
          <h2 style={{ fontSize: "2.5rem", margin: "0" }}>{currentCard.term}</h2>
          {!isRevealed && <p style={{ marginTop: "1.5rem", color: "#999", fontSize: "0.9rem" }}>Tap to reveal answer</p>}
        </div>

        {isRevealed && (
          <div className="card-back" style={{ width: "100%", paddingTop: "2rem", borderTop: "1px solid #eaeaea" }}>
            <h3 style={{ fontSize: "1.8rem", color: "#0052cc", margin: "0 0 0.5rem 0" }}>{currentCard.translation}</h3>
            
            {currentCard.pronunciation && (
              <p style={{ fontSize: "1.1rem", color: "#666", margin: "0 0 1rem 0" }}>🗣️ {currentCard.pronunciation}</p>
            )}
            
            {currentCard.example_sentence && (
              <p style={{ fontSize: "1.1rem", fontStyle: "italic", margin: "0", color: "#333", background: "#f8f9fa", padding: "1rem", borderRadius: "8px" }}>
                "{currentCard.example_sentence}"
              </p>
            )}
          </div>
        )}
      </div>

      {isRevealed && (
        <div className="rating-actions" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginTop: "2rem" }}>
          <button 
            disabled={submitting}
            onClick={() => handleRating("unknown")}
            style={{ padding: "1rem 0", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: submitting ? "wait" : "pointer" }}>
            Unknown
          </button>
          <button 
            disabled={submitting}
            onClick={() => handleRating("hard")}
            style={{ padding: "1rem 0", background: "#ffedd5", color: "#c2410c", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: submitting ? "wait" : "pointer" }}>
            Hard
          </button>
          <button 
            disabled={submitting}
            onClick={() => handleRating("medium")}
            style={{ padding: "1rem 0", background: "#e0f2fe", color: "#0369a1", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: submitting ? "wait" : "pointer" }}>
            Medium
          </button>
          <button 
            disabled={submitting}
            onClick={() => handleRating("easy")}
            style={{ padding: "1rem 0", background: "#dcfce7", color: "#15803d", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: submitting ? "wait" : "pointer" }}>
            Easy
          </button>
        </div>
      )}
    </div>
  );
}
