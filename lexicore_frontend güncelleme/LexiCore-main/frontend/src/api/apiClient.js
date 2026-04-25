import { signOut } from "firebase/auth";

import { auth } from "../lib/firebase";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(
  /\/$/,
  ""
);

export class ApiAuthError extends Error {
  constructor(message = "Your session is no longer valid. Please sign in again.") {
    super(message);
    this.name = "ApiAuthError";
  }
}

export async function authorizedFetch(path, { user, headers, ...options } = {}) {
  if (!user) {
    throw new ApiAuthError("Your session is still loading. Please try again.");
  }

  const token = await user.getIdToken();
  const requestHeaders = new Headers(headers || {});
  requestHeaders.set("Authorization", `Bearer ${token}`);

  if (options.body && !(options.body instanceof FormData) && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: requestHeaders,
  });

  if (response.status === 401) {
    await signOut(auth);
    throw new ApiAuthError();
  }

  return response;
}


export async function readJsonResponse(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.detail || fallbackMessage);
  }

  return payload;
}
