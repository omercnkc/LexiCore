import { useNavigate } from "react-router-dom";

import AuthForm from "../components/AuthForm";
import { useAuth } from "../context/AuthContext";

function mapFirebaseError(error) {
  if (error.code === "auth/email-already-in-use") {
    return new Error("That email is already registered.");
  }

  if (error.code === "auth/weak-password") {
    return new Error("Use a stronger password with at least 6 characters.");
  }

  return new Error("Unable to create your account right now.");
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const handleSubmit = async ({ displayName, email, password }) => {
    try {
      await register({ displayName, email, password });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      throw mapFirebaseError(error);
    }
  };

  return (
    <AuthForm
      mode="register"
      title="Create your LexiCore account"
      description="Start building course-specific terminology decks and keep your review sessions structured."
      submitLabel="Create account"
      footerLabel="Already have an account?"
      footerLinkLabel="Log in"
      footerLinkTo="/login"
      onSubmit={handleSubmit}
    />
  );
}

