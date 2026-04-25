import { useNavigate } from "react-router-dom";

import AuthForm from "../components/AuthForm";
import { useAuth } from "../context/AuthContext";

function mapFirebaseError(error) {
  if (error.code === "auth/invalid-credential") {
    return new Error("Email or password is incorrect.");
  }

  if (error.code === "auth/too-many-requests") {
    return new Error("Too many attempts. Try again in a few minutes.");
  }

  return new Error("Unable to sign in right now.");
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async ({ email, password }) => {
    try {
      await login({ email, password });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      throw mapFirebaseError(error);
    }
  };

  return (
    <AuthForm
      mode="login"
      title="Welcome back to LexiCore"
      description="Sign in to review cards, manage decks, and keep your terminology practice moving."
      submitLabel="Log in"
      footerLabel="Need an account?"
      footerLinkLabel="Create one"
      footerLinkTo="/register"
      onSubmit={handleSubmit}
    />
  );
}

