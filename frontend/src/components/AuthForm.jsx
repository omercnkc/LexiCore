import { Link } from "react-router-dom";
import { useState } from "react";

const INITIAL_VALUES = {
  displayName: "",
  email: "",
  password: "",
};

export default function AuthForm({
  mode,
  title,
  description,
  submitLabel,
  footerLabel,
  footerLinkLabel,
  footerLinkTo,
  onSubmit,
}) {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await onSubmit(values);
    } catch (submitError) {
      setError(submitError.message || "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>{title}</h1>
        <p>{description}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <div className="auth-field">
              <label htmlFor="displayName">Full name</label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                placeholder="Ada Lovelace"
                value={values.displayName}
                onChange={handleChange}
                required
              />
            </div>
          ) : null}

          <div className="auth-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="student@university.edu"
              value={values.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Minimum 6 characters"
              value={values.password}
              onChange={handleChange}
              minLength={6}
              required
            />
          </div>

          {error ? <div className="form-error">{error}</div> : null}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : submitLabel}
          </button>
        </form>

        <div className="auth-footer">
          {footerLabel} <Link to={footerLinkTo}>{footerLinkLabel}</Link>
        </div>
      </div>
    </div>
  );
}

