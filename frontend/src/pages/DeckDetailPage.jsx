import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

import { fetchDeck, deleteDeck } from "../api/decksApi";
import { fetchDeckCards } from "../api/cardsApi";
import { ApiAuthError } from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import {
  formatDeckDate,
} from "../lib/deckUtils";
import CardManager from "../components/CardManager";

export default function DeckDetailPage() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleDeleteDeck = async () => {
    if (!window.confirm(`"${deck.title}" dersini ve tüm kartlarını silmek istediğinize emin misiniz?`)) return;
    setDeleting(true);
    try {
      await deleteDeck(user, deckId);
      navigate("/lessons", { replace: true });
    } catch (err) {
      alert("Silinemedi: " + err.message);
      setDeleting(false);
    }
  };

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Ders Detayı</p>
          <h1>{loading ? "Yükleniyor..." : deck?.title || "Ders bulunamadı"}</h1>
        </div>
        <div className="inline-actions">
          {deck?.card_count > 0 && (
            <Link className="primary-button" to={`/decks/${deck.id}/study`} style={{ background: "#10b981", borderColor: "#10b981" }}>
              Çalışmaya Başla
            </Link>
          )}
          <Link className="secondary-button" to={`/courses/${encodeURIComponent(deck?.course_name || "")}`}>
            Geri Dön
          </Link>
          {deck && (
            <button
              className="secondary-button"
              style={{ color: "#dc2626", borderColor: "#dc2626" }}
              onClick={handleDeleteDeck}
              disabled={deleting}
            >
              {deleting ? "Siliniyor..." : "Dersi Sil"}
            </button>
          )}
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      {loading ? <div className="content-card">Ders bilgileri yükleniyor...</div> : null}

      {!loading && !error && deck ? (
        <>
          <section className="detail-grid" style={{ gridTemplateColumns: "1fr" }}>
            <article id="card-manager-section" style={{ gridColumn: "1 / -1" }}>
              <CardManager
                key={deck.id}
                deckId={deck.id}
                initialCards={cards}
                onCardChange={handleCardCountChange}
                autoOpenForm={showAddOptions}
              />
            </article>
          </section>
        </>
      ) : null}
    </section>
  );
}
