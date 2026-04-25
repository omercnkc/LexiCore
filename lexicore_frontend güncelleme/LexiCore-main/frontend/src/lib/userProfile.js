import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "./firebase";

export async function ensureUserProfile(user, overrides = {}) {
  const userRef = doc(db, "users", user.uid);
  const existingSnapshot = await getDoc(userRef);

  await setDoc(
    userRef,
    {
      uid: user.uid,
      email: user.email,
      displayName: overrides.displayName || user.displayName || "",
      authProvider: "password",
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      createdAt: existingSnapshot.exists()
        ? existingSnapshot.data().createdAt || serverTimestamp()
        : serverTimestamp(),
    },
    { merge: true }
  );

  const snapshot = await getDoc(userRef);
  return snapshot.data();
}
