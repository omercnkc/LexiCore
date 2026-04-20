import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchDecks } from "../api/decksApi";
import { fetchDashboardSummary, fetchWeeklyProgress } from "../api/analyticsApi";
import { ApiAuthError } from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { formatDeckCourseTopic, formatDeckDate, formatDeckProgress } from "../lib/deckUtils";

function WeeklyProgressChart({ days }) {
  if (!days || days.length === 0) return null;
  const maxReviews = Math.max(...days.map(d => d.review_count), 1);
  
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', height: '150px', gap: '12px', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', marginTop: '1rem' }}>
      {days.map((day, i) => {
        const heightPercent = (day.review_count / maxReviews) * 100;
        const dateObj = new Date(day.date + 'T12:00:00Z'); // Normalize hack for display
        const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
        
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <div style={{ fontSize: '0.8rem', marginBottom: '4px', color: '#666', fontWeight: '500' }}>{day.review_count > 0 ? day.review_count : ""}</div>
            <div style={{ 
              width: '100%', 
              height: `${Math.max(heightPercent, 2)}%`, 
              background: day.review_count > 0 ? '#0052cc' : '#e5e7eb', 
              borderRadius: '4px 4px 0 0',
              transition: 'height 0.5s ease'
            }}></div>
            <div style={{ fontSize: '0.75rem', marginTop: '8px', color: '#333' }}>{dateStr}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [decks, setDecks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

    async function loadDashboard() {
      setLoading(true);

      try {
        const [decksData, summaryData, weeklyData] = await Promise.all([
          fetchDecks(user),
          fetchDashboardSummary(user),
          fetchWeeklyProgress(user)
        ]);

        if (isActive) {
          setDecks(decksData.items || []);
          setSummary(summaryData);
          setWeekly(weeklyData.days || []);
          setError("");
        }
      } catch (error) {
        if (error instanceof ApiAuthError) return;
        if (isActive) setError(error.message || "Unable to load dashboard.");
      } finally {
        if (isActive) setLoading(false);
      }
    }

    loadDashboard();
    return () => { isActive = false; };
  }, [authLoading, user]);

  return (
    <>
      <section className="dashboard-hero" style={{ paddingBottom: '1rem' }}>
        <span className="status-chip">Step 5 Analytics Live</span>
        <h1>Welcome back, {profile?.displayName || profile?.email || "Student"}.</h1>
        <p>
          Your daily focus and 7-day progress are actively monitored. Drill those due cards!
        </p>
        <div className="dashboard-actions">
          <Link className="primary-button" to="/upload" style={{ background: "#4f46e5", borderColor: "#4f46e5" }}>+ Generate from PDF</Link>
          <Link className="secondary-button" to="/decks/new">+ Manual Deck</Link>
        </div>
      </section>

      {error ? <div className="form-error">{error}</div> : null}
      {loading ? <div className="content-card">Loading analytics...</div> : null}

      {!loading && !error && summary ? (
        <section className="analytics-overview" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem',
          margin: '0 0 3rem 0'
        }}>
          <div className="content-card" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>Due Today</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0', color: summary.cards_due_today > 0 ? '#b45309' : '#10b981' }}>
              {summary.cards_due_today}
            </p>
          </div>
          
          <div className="content-card" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>7-Day Reviews</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0' }}>{summary.reviews_last_7_days}</p>
          </div>

          <div className="content-card" style={{ padding: '1.5rem', borderLeft: '4px solid #3b82f6' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>Accuracy rate</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0' }}>{summary.average_accuracy}%</p>
          </div>

          <div className="content-card" style={{ padding: '1.5rem', borderLeft: '4px solid #6366f1' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>Weakest Deck</h3>
            <p style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0', alignSelf: 'center', paddingTop: '0.5rem' }}>
              {summary.weakest_deck_name}
            </p>
          </div>
        </section>
      ) : null}

      {!loading && !error && weekly && weekly.length > 0 ? (
        <section className="page-section" style={{ marginBottom: '3rem' }}>
          <div className="content-card">
            <h2 style={{ margin: '0 0 0.5rem 0' }}>Activity Overview</h2>
            <p style={{ color: '#555', fontSize: '0.9rem', margin: '0' }}>Your card reviews completed over the last 7 days.</p>
            <WeeklyProgressChart days={weekly} />
          </div>
        </section>
      ) : null}

      <section className="page-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h2>Your active decks</h2>
          </div>
          {!loading && decks.length > 0 ? <span>{decks.length} total</span> : null}
        </div>

        {!loading && !error && decks.length === 0 ? (
          <div className="empty-state">
            <p className="eyebrow">No decks yet</p>
            <h3>Create your first course deck</h3>
            <p>Start with a title, course name, and topic.</p>
            <Link className="primary-button" to="/decks/new">Create first deck</Link>
          </div>
        ) : null}

        {!loading && !error && decks.length > 0 ? (
          <div className="deck-grid">
            {decks.map((deck) => (
              <Link className="deck-card" key={deck.id} to={`/decks/${deck.id}`}>
                <div className="deck-card-top">
                  <div>
                    <p className="eyebrow">{deck.source_type === "file" ? "Generated from file" : "Manual deck"}</p>
                    <h3>{deck.title}</h3>
                  </div>
                  <span className="deck-progress">{formatDeckProgress(deck.progress_percent)}</span>
                </div>
                <p className="deck-course">{formatDeckCourseTopic(deck)}</p>
                {deck.source_type === "file" && deck.source_file_name ? (
                  <p className="deck-course" style={{ marginTop: "0.35rem", fontSize: "0.9rem", opacity: 0.82 }}>
                    Source: {deck.source_file_name}
                  </p>
                ) : null}
                <div className="deck-meta-row">
                  <span>Created {formatDeckDate(deck.created_at)}</span>
                  <span>{deck.card_count} cards</span>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}
