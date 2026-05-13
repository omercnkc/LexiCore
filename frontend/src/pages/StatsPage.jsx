import { useEffect, useState } from "react";
import { fetchDashboardSummary, fetchWeeklyProgress } from "../api/analyticsApi";
import { ApiAuthError } from "../api/apiClient";
import { useAuth } from "../context/AuthContext";

function WeeklyProgressChart({ days }) {
  if (!days || days.length === 0) return null;
  const maxReviews = Math.max(...days.map((d) => d.review_count), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", height: "160px", gap: "10px", padding: "1rem", background: "rgba(15,118,110,0.04)", borderRadius: "12px", marginTop: "1rem" }}>
      {days.map((day, i) => {
        const heightPercent = (day.review_count / maxReviews) * 100;
        const dateObj = new Date(day.date + "T12:00:00Z");
        const dateStr = dateObj.toLocaleDateString(undefined, { weekday: "short" });
        const hasAnswerData = day.correct_count > 0 || day.wrong_count > 0;
        const totalAnswered = day.correct_count + day.wrong_count;
        const correctPercent = totalAnswered > 0 ? (day.correct_count / totalAnswered) * 100 : 0;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            <div style={{ fontSize: "0.7rem", marginBottom: "4px", color: "#666", textAlign: "center" }}>
              {day.review_count > 0 ? day.review_count : ""}
            </div>
            <div style={{ width: "100%", height: `${Math.max(heightPercent, 3)}%`, borderRadius: "4px 4px 0 0", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              {hasAnswerData ? (
                <>
                  <div style={{ width: "100%", height: `${correctPercent}%`, background: "#10b981", minHeight: correctPercent > 0 ? "2px" : "0" }} />
                  <div style={{ width: "100%", height: `${100 - correctPercent}%`, background: "#ef4444", minHeight: (100 - correctPercent) > 0 ? "2px" : "0" }} />
                </>
              ) : (
                <div style={{ width: "100%", height: "100%", background: day.review_count > 0 ? "#0052cc" : "#e5e7eb" }} />
              )}
            </div>
            <div style={{ fontSize: "0.72rem", marginTop: "6px", color: "#555" }}>{dateStr}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function StatsPage() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;
    if (authLoading) { setLoading(true); return () => { isActive = false; }; }
    if (!user) { setLoading(false); return () => { isActive = false; }; }

    async function load() {
      setLoading(true);
      try {
        const [summaryData, weeklyData] = await Promise.all([fetchDashboardSummary(user), fetchWeeklyProgress(user)]);
        if (isActive) { setSummary(summaryData); setWeekly(weeklyData.days || []); setError(""); }
      } catch (err) {
        if (err instanceof ApiAuthError) return;
        if (isActive) setError(err.message || "İstatistikler yüklenemedi.");
      } finally {
        if (isActive) setLoading(false);
      }
    }
    load();
    return () => { isActive = false; };
  }, [authLoading, user]);

  return (
    <div className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Performans</p>
          <h1>İstatistikler</h1>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {loading ? <div className="content-card">Yükleniyor...</div> : null}

      {!loading && !error && summary ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
          {[
            { label: "Bugün Bekleyen", value: summary.cards_due_today, color: "#f59e0b" },
            { label: "7 Günlük Tekrar", value: summary.reviews_last_7_days, color: "#10b981" },
            { label: "Doğru / Yanlış", value: `${summary.total_correct} / ${summary.total_wrong}`, color: "#3b82f6" },
            { label: "Cevap Başarısı", value: `%${summary.answer_accuracy_percent}`, color: "#8b5cf6" },
            { label: "Ort. Benzerlik", value: `%${summary.avg_similarity_score}`, color: "#06b6d4" },
          ].map((stat) => (
            <div key={stat.label} className="content-card" style={{ padding: "1.5rem", borderLeft: `4px solid ${stat.color}` }}>
              <h3 style={{ fontSize: "0.82rem", color: "#666", margin: "0 0 0.5rem", textTransform: "uppercase" }}>{stat.label}</h3>
              <p style={{ fontSize: "1.8rem", fontWeight: "bold", margin: 0 }}>{stat.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && !error && weekly && weekly.length > 0 ? (
        <div className="content-card">
          <h2 style={{ margin: "0 0 0.5rem" }}>Haftalık Aktivite</h2>
          <p style={{ color: "#555", fontSize: "0.9rem", margin: 0 }}>
            Son 7 günlük tekrar performansınız.
            <span style={{ color: "#10b981", fontWeight: 600 }}> ■</span> Doğru
            <span style={{ color: "#ef4444", fontWeight: 600 }}> ■</span> Yanlış
          </p>
          <WeeklyProgressChart days={weekly} />
        </div>
      ) : null}

      {!loading && !error && summary?.weakest_deck_name ? (
        <div className="content-card" style={{ borderLeft: "4px solid #6366f1" }}>
          <h3 style={{ margin: "0 0 0.4rem", fontSize: "0.85rem", color: "#666", textTransform: "uppercase" }}>En Zayıf Deste</h3>
          <p style={{ margin: 0, fontWeight: "700", fontSize: "1.1rem" }}>{summary.weakest_deck_name}</p>
        </div>
      ) : null}
    </div>
  );
}
