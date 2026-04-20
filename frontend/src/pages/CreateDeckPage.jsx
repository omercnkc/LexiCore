import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { createDeck } from "../api/decksApi";
import { ApiAuthError } from "../api/apiClient";
import { useAuth } from "../context/AuthContext";

const INITIAL_FORM = {
  title: "",
  course_name: "",
  topic_name: "",
};

export default function CreateDeckPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      title: form.title.trim(),
      course_name: form.course_name.trim(),
      topic_name: form.topic_name.trim(),
    };

    if (!payload.title || !payload.course_name || !payload.topic_name) {
      setError("Title, course name, and topic name are required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const deck = await createDeck(user, payload);
      navigate(`/decks/${deck.id}`, { replace: true });
    } catch (error) {
      if (error instanceof ApiAuthError) {
        return;
      }

      setError(error.message || "Unable to create this deck.");
      setSubmitting(false);
    }
  };

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Create deck</p>
          <h1>Start a new deck</h1>
        </div>
        <Link className="secondary-button" to="/dashboard">
          Back to dashboard
        </Link>
      </div>

      <div className="form-shell">
        <div className="content-card content-card-muted">
          <p className="eyebrow">Source</p>
          <h2>Manual deck setup</h2>
          <p>
            This deck is created manually today, but the same document shape is ready for future
            file uploads and generated card pipelines.
          </p>
        </div>

        <form className="content-card deck-form" onSubmit={handleSubmit}>
          <div className="form-header">
            <h2>Deck details</h2>
            <p>Keep names specific so future cards, reviews, and analytics stay organized.</p>
          </div>

          {error ? <div className="form-error">{error}</div> : null}

          <label className="auth-field" htmlFor="title">
            <span>Title</span>
            <input
              id="title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Ex: Renal Pathology Core Terms"
              maxLength={120}
              required
            />
          </label>

          <label className="auth-field" htmlFor="course_name">
            <span>Course name</span>
            <input
              id="course_name"
              name="course_name"
              value={form.course_name}
              onChange={handleChange}
              placeholder="Ex: Pathology II"
              maxLength={120}
              required
            />
          </label>

          <label className="auth-field" htmlFor="topic_name">
            <span>Topic name</span>
            <input
              id="topic_name"
              name="topic_name"
              value={form.topic_name}
              onChange={handleChange}
              placeholder="Ex: Kidney Disease"
              maxLength={120}
              required
            />
          </label>

          <div className="form-actions">
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? "Creating deck..." : "Create deck"}
            </button>
            <Link className="secondary-button" to="/dashboard">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}
