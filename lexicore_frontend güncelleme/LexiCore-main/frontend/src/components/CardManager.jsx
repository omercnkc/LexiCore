import { useEffect, useState } from "react";
import { createCard, deleteCard, updateCard } from "../api/cardsApi";
import { useAuth } from "../context/AuthContext";

export default function CardManager({ deckId, initialCards, onCardChange, autoOpenForm }) {
  const { user, loading } = useAuth();
  const [cards, setCards] = useState(initialCards || []);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Auto-open form when triggered from parent
  useEffect(() => {
    if (autoOpenForm) setIsAdding(true);
  }, [autoOpenForm]);
  
  // Form states
  const [term, setTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [pronunciation, setPronunciation] = useState("");
  const [exampleSentence, setExampleSentence] = useState("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCards(initialCards || []);
    setIsAdding(false);
    setEditingId(null);
    setError("");
  }, [deckId, initialCards]);

  const resetForm = () => {
    setTerm("");
    setTranslation("");
    setPronunciation("");
    setExampleSentence("");
    setIsAdding(false);
    setEditingId(null);
    setError("");
  };

  const handleStartEdit = (card) => {
    setTerm(card.term);
    setTranslation(card.translation);
    setPronunciation(card.pronunciation || "");
    setExampleSentence(card.example_sentence || "");
    setEditingId(card.id);
    setIsAdding(false);
    setError("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (loading || !user) {
      setError("Your session is still loading. Please try again.");
      return;
    }

    if (!term.trim() || !translation.trim()) {
      setError("Term and translation are required.");
      return;
    }

    setIsSaving(true);
    setError("");

    const cardData = {
      term: term.trim(),
      translation: translation.trim(),
      pronunciation: pronunciation.trim() || null,
      example_sentence: exampleSentence.trim() || null,
    };

    try {
      if (editingId) {
        const updatedCard = await updateCard(user, editingId, cardData);
        setCards(cards.map(c => c.id === editingId ? updatedCard : c));
      } else {
        const newCard = await createCard(user, deckId, cardData);
        // Note: In a real app we might want to refetch or prepend. We prepend here.
        setCards([newCard, ...cards]);
        if (onCardChange) onCardChange(1); // Increment count
      }
      resetForm();
    } catch (err) {
      setError(err.message || "Failed to save card.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (cardId) => {
    if (loading || !user) {
      alert("Your session is still loading. Please try again.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this card?")) return;
    try {
      await deleteCard(user, cardId);
      setCards(cards.filter(c => c.id !== cardId));
      if (onCardChange) onCardChange(-1); // Decrement count
    } catch (err) {
      alert("Failed to delete card: " + err.message);
    }
  };

  return (
    <div className="card-manager">
      <div className="card-manager-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Cards ({cards.length})</h3>
        {!isAdding && !editingId && (
          <button className="primary-button" onClick={() => setIsAdding(true)} disabled={loading || !user}>
            + Add Card
          </button>
        )}
      </div>

      {(isAdding || editingId) && (
        <form onSubmit={handleSave} className="content-card form-layout" style={{ marginBottom: '2rem', border: '1px solid #0052cc' }}>
          <h4>{editingId ? "Edit Card" : "New Card"}</h4>
          {error && <div className="form-error">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="term">Term (required)</label>
            <input id="term" value={term} onChange={e => setTerm(e.target.value)} disabled={isSaving} required />
          </div>
          
          <div className="form-group">
            <label htmlFor="translation">Translation (required)</label>
            <input id="translation" value={translation} onChange={e => setTranslation(e.target.value)} disabled={isSaving} required />
          </div>
          
          <div className="form-group">
            <label htmlFor="pronunciation">Pronunciation (optional)</label>
            <input id="pronunciation" value={pronunciation} onChange={e => setPronunciation(e.target.value)} disabled={isSaving} />
          </div>
          
          <div className="form-group">
            <label htmlFor="exampleSentence">Example Sentence (optional)</label>
            <textarea id="exampleSentence" value={exampleSentence} onChange={e => setExampleSentence(e.target.value)} disabled={isSaving} rows={2} />
          </div>

          <div className="inline-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="secondary-button" onClick={resetForm} disabled={isSaving}>Cancel</button>
            <button type="submit" className="primary-button" disabled={isSaving}>
              {isSaving ? "Saving..." : (editingId ? "Update Card" : "Add Card")}
            </button>
          </div>
        </form>
      )}

      {cards.length === 0 && !isAdding ? (
        <div className="empty-state" style={{ padding: '2rem', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
          <p>No cards in this deck yet.</p>
        </div>
      ) : (
        <div className="cards-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {cards.map(card => (
            <div key={card.id} className="content-card card-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem' }}>
              <div className="card-content">
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>{card.term}</h4>
                <p style={{ margin: '0 0 0.25rem 0', fontWeight: '500' }}>{card.translation}</p>
                {card.pronunciation && <p style={{ margin: '0 0 0.25rem 0', color: '#666', fontSize: '0.9rem' }}>🗣️ {card.pronunciation}</p>}
                {card.example_sentence && <p style={{ margin: '0', fontStyle: 'italic', fontSize: '0.9rem', color: '#444' }}>"{card.example_sentence}"</p>}
              </div>
              <div className="card-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <button className="secondary-button" onClick={() => handleStartEdit(card)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>Edit</button>
                <button className="secondary-button" onClick={() => handleDelete(card.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: '#d32f2f' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
