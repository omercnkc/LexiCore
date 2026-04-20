import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="navbar">
      <div className="navbar-primary">
        <NavLink className="navbar-brand" to="/dashboard">
          LexiCore
        </NavLink>
        <nav className="navbar-links" aria-label="Primary">
          <NavLink
            className={({ isActive }) => `navbar-link${isActive ? " is-active" : ""}`}
            to="/dashboard"
          >
            Dashboard
          </NavLink>
          <NavLink
            className={({ isActive }) => `navbar-link${isActive ? " is-active" : ""}`}
            to="/decks/new"
          >
            New deck
          </NavLink>
        </nav>
      </div>
      <div className="navbar-meta">
        <span>{profile?.displayName || profile?.email || "Student"}</span>
        <button className="secondary-button" type="button" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}
