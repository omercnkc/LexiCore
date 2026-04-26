import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicOnlyRoute from "./components/PublicOnlyRoute";
import LessonsPage from "./pages/LessonsPage";
import UploadPage from "./pages/UploadPage";
import DashboardPage from "./pages/DashboardPage";
import DeckDetailPage from "./pages/DeckDetailPage";
import StudyPage from "./pages/StudyPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import PdfPage from "./pages/PdfPage";
import StatsPage from "./pages/StatsPage";
import ProfilePage from "./pages/ProfilePage";

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/lessons" element={<LessonsPage />} />
        <Route path="/pdf" element={<PdfPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/decks/:deckId" element={<DeckDetailPage />} />
        <Route path="/decks/:deckId/study" element={<StudyPage />} />
        <Route path="/decks/:deckId/upload" element={<UploadPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="*"
        element={
          <Navigate to="/dashboard" replace />
        }
      />
    </Routes>
  );
}
