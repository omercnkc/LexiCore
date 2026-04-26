import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

import { fetchDeck, deleteDeck } from "../api/decksApi";
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
          <Link className="secondary-button" to="/lessons">
            Derslere Dön
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
          <section className="deck-detail-hero">
            <div>
              <p className="eyebrow">Ders / Konu</p>
              <h2>{formatDeckCourseTopic(deck)}</h2>
            </div>
            <div className="deck-meta-stack">
              <span>Oluşturulma {formatDeckDate(deck.created_at)}</span>
              <span>Güncelleme {formatDeckDate(deck.updated_at)}</span>
            </div>
          </section>

          <section className="detail-grid">
            <article className="content-card">
              <p className="eyebrow">Genel Bilgi</p>
              <h3>Ders Özeti</h3>
              <div className="detail-list">
                <div className="detail-item">
                  <span>Kaynak Türü</span>
                  <strong>{deck.source_type === "file" ? "PDF" : "Manuel"}</strong>
                </div>
                <div className="detail-item">
                  <span>Kaynak Dosya</span>
                  <strong>{deck.source_file_name || "Yok"}</strong>
                </div>
                <div className="detail-item">
                  <span>İlerleme</span>
                  <strong>{formatDeckProgress(deck.progress_percent)}</strong>
                </div>
                <div className="detail-item">
                  <span>Kartlar</span>
                  <strong>{deck.card_count}</strong>
                </div>
              </div>
            </article>

            {/* Add Cards Section */}
            <article className="content-card">
              <p className="eyebrow">Kart Ekle</p>
              <h3>Yeni kartlar oluştur</h3>
              <p>PDF yükleyerek AI ile otomatik kart oluşturabilir veya manuel olarak kart ekleyebilirsiniz.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "1rem" }}>
                <Link
                  className="primary-button"
                  to={`/decks/${deck.id}/upload`}
                  style={{ textAlign: "center", background: "#4f46e5" }}
                >
                  📄 PDF ile AI Analizi
                </Link>
                <button
                  className="secondary-button"
                  style={{ textAlign: "center" }}
                  onClick={() => {
                    setShowAddOptions(true);
                    // Scroll to CardManager
                    setTimeout(() => {
                      const el = document.getElementById("card-manager-section");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                  }}
                >
                  ✏️ Manuel Kart Ekle
                </button>
              </div>
            </article>

            <article id="card-manager-section" style={{ gridColumn: "1 / -1", marginTop: "2rem" }}>
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
