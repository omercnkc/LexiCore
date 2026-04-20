import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { fetchDeck } from "../api/decksApi";
import { fetchDeckCards } from "../api/cardsApi";
import { ApiAuthError } from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import {
  formatDeckCourseTopic,
  formatDeckDate,
  formatDeckProgress,
} from "../lib/deckUtils";
import CardManager from "../components/CardManager";

export default function DeckDetailPage() {
  const { deckId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    if (authLoading) {
      setLoading(true);
      return () => {
        isActive = false;
      };
    }

    if (!user) {
      setLoading(false);
      return () => {
        isActive = false;
      };
    }

    async function loadData() {
      setLoading(true);

      try {
        const [deckData, cardsData] = await Promise.all([
          fetchDeck(user, deckId),
          fetchDeckCards(user, deckId)
        ]);
        
        if (isActive) {
          setDeck(deckData);
          setCards(cardsData.items || []);
          setError("");
        }
      } catch (error) {
        if (error instanceof ApiAuthError) {
          return;
        }

        if (isActive) {
          setError(error.message || "Unable to load this deck.");
          setDeck(null);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isActive = false;
    };
  }, [authLoading, deckId, user]);

  const handleCardCountChange = (delta) => {
    if (deck) {
      setDeck({
        ...deck,
        card_count: Math.max(0, deck.card_count + delta)
      });
    }
  };

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Deck detail</p>
          <h1>{loading ? "Loading deck..." : deck?.title || "Deck not found"}</h1>
        </div>
        <div className="inline-actions">
          {deck?.card_count > 0 && (
            <Link className="primary-button" to={`/decks/${deck.id}/study`} style={{ background: "#10b981", borderColor: "#10b981" }}>
              Start Study
            </Link>
          )}
          <Link className="secondary-button" to="/dashboard">
            Back to dashboard
          </Link>
          <Link className="primary-button" to="/decks/new">
            Create another deck
          </Link>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      {loading ? <div className="content-card">Loading deck details...</div> : null}

      {!loading && !error && deck ? (
        <>
          <section className="deck-detail-hero">
            <div>
              <p className="eyebrow">Course / topic</p>
              <h2>{formatDeckCourseTopic(deck)}</h2>
            </div>
            <div className="deck-meta-stack">
              <span>Created {formatDeckDate(deck.created_at)}</span>
              <span>Updated {formatDeckDate(deck.updated_at)}</span>
            </div>
          </section>

          <section className="detail-grid">
            <article className="content-card">
              <p className="eyebrow">Overview</p>
              <h3>MVP deck metadata</h3>
              <div className="detail-list">
                <div className="detail-item">
                  <span>Source type</span>
                  <strong>{deck.source_type}</strong>
                </div>
                <div className="detail-item">
                  <span>Source file</span>
                  <strong>{deck.source_file_name || "None attached"}</strong>
                </div>
                <div className="detail-item">
                  <span>Progress</span>
                  <strong>{formatDeckProgress(deck.progress_percent)}</strong>
                </div>
                <div className="detail-item">
                  <span>Cards</span>
                  <strong>{deck.card_count}</strong>
                </div>
              </div>
            </article>

            <article style={{ gridColumn: "1 / -1", marginTop: "2rem" }}>
              <CardManager key={deck.id} deckId={deck.id} initialCards={cards} onCardChange={handleCardCountChange} />
            </article>
          </section>
        </>
      ) : null}
    </section>
  );
}
