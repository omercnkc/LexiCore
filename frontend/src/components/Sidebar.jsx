import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const initials = profile?.displayName
    ? profile.displayName.slice(0, 2).toUpperCase()
    : profile?.email
    ? profile.email.slice(0, 2).toUpperCase()
    : "??";

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">L</span>
        </div>
        <span className="sidebar-brand-name">LexiCore</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Main Navigation">
        {/* User Profile */}
        <NavLink
          className={({ isActive }) =>
            `sidebar-link${isActive ? " sidebar-link--active" : ""}`
          }
          to="/profile"
        >
          <span className="sidebar-link-icon">
            <div className="sidebar-avatar">{initials}</div>
          </span>
          <span className="sidebar-link-label">
            {profile?.displayName || profile?.email || "Profil"}
          </span>
        </NavLink>

        {/* Homepage */}
        <NavLink
          className={({ isActive }) =>
            `sidebar-link${isActive ? " sidebar-link--active" : ""}`
          }
          to="/dashboard"
        >
          <span className="sidebar-link-icon">🏠</span>
          <span className="sidebar-link-label">Homepage</span>
        </NavLink>

        {/* PDF */}
        <NavLink
          className={({ isActive }) =>
            `sidebar-link${isActive ? " sidebar-link--active" : ""}`
          }
          to="/pdf"
        >
          <span className="sidebar-link-icon">📄</span>
          <span className="sidebar-link-label">PDF</span>
        </NavLink>

        {/* Dersler */}
        <NavLink
          className={({ isActive }) =>
            `sidebar-link${isActive ? " sidebar-link--active" : ""}`
          }
          to="/lessons"
        >
          <span className="sidebar-link-icon">📚</span>
          <span className="sidebar-link-label">Dersler</span>
        </NavLink>

        {/* İstatistik */}
        <NavLink
          className={({ isActive }) =>
            `sidebar-link${isActive ? " sidebar-link--active" : ""}`
          }
          to="/stats"
        >
          <span className="sidebar-link-icon">📊</span>
          <span className="sidebar-link-label">İstatistik</span>
        </NavLink>
      </nav>

      {/* Bottom: Logout */}
      <div className="sidebar-footer">
        <button className="sidebar-link sidebar-logout" onClick={handleLogout}>
          <span className="sidebar-link-icon">🚪</span>
          <span className="sidebar-link-label">Çıkış</span>
        </button>
      </div>
    </aside>
  );
}
