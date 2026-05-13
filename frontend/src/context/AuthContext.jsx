import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { auth } from "../lib/firebase";
import { ensureUserProfile } from "../lib/userProfile";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => auth.currentUser);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const pendingProfileRef = useRef(null);
  const hasInitializedRef = useRef(false);
  const profileRequestIdRef = useRef(0);

  useEffect(() => {
    let isActive = true;

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      const requestId = profileRequestIdRef.current + 1;
      profileRequestIdRef.current = requestId;

      if (isActive) {
        setUser(nextUser);
      }

      try {
        if (nextUser) {
          const nextProfile = await ensureUserProfile(nextUser, pendingProfileRef.current || {});
          if (isActive && profileRequestIdRef.current === requestId) {
            setProfile(nextProfile);
            pendingProfileRef.current = null;
          }
        } else {
          if (isActive && profileRequestIdRef.current === requestId) {
            setProfile(null);
            pendingProfileRef.current = null;
          }
        }
      } catch (error) {
        console.error("Unable to sync authenticated user profile.", error);
        if (isActive && profileRequestIdRef.current === requestId) {
          setProfile(null);
        }
      } finally {
        if (isActive && !hasInitializedRef.current) {
          hasInitializedRef.current = true;
          setLoading(false);
        }
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  const register = async ({ displayName, email, password }) => {
    pendingProfileRef.current = { displayName };

    try {
      await setPersistence(auth, browserLocalPersistence);

      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName });
      await credential.user.reload();
      setUser(auth.currentUser);

      return credential.user;
    } catch (error) {
      pendingProfileRef.current = null;
      throw error;
    }
  };

  const login = async ({ email, password }) => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      setUser(credential.user);
      return credential.user;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      throw error;
    }
  };

  const updateUserProfile = async ({ displayName }) => {
    if (!auth.currentUser) throw new Error("Kullanıcı oturumu bulunamadı.");
    await updateProfile(auth.currentUser, { displayName });
    await auth.currentUser.reload();
    const refreshed = await ensureUserProfile(auth.currentUser, { displayName });
    setProfile(refreshed);
    setUser({ ...auth.currentUser });
  };

  const updateUserPassword = async ({ currentPassword, newPassword }) => {
    if (!auth.currentUser) throw new Error("Kullanıcı oturumu bulunamadı.");
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  };

  const value = {
    user,
    profile,
    loading,
    login,
    register,
    logout,
    updateUserProfile,
    updateUserPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
