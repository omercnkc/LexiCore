import { authorizedFetch, readJsonResponse } from "./apiClient";

export async function fetchDecks(user) {
  const response = await authorizedFetch("/api/decks", {
    user,
  });

  return readJsonResponse(response, "Unable to load your decks.");
}

export async function fetchDeck(user, deckId) {
  const response = await authorizedFetch(`/api/decks/${deckId}`, {
    user,
  });

  return readJsonResponse(response, "Unable to load this deck.");
}

export async function createDeck(user, payload) {
  const response = await authorizedFetch("/api/decks", {
    method: "POST",
    user,
    body: JSON.stringify(payload),
  });

  return readJsonResponse(response, "Unable to create this deck.");
}

export async function deleteDeck(user, deckId) {
  const response = await authorizedFetch(`/api/decks/${deckId}`, {
    method: "DELETE",
    user,
  });

  if (!response.ok) {
    throw new Error("Unable to delete this deck.");
  }

  return true;
}

export async function updateDeck(user, deckId, payload) {
  const response = await authorizedFetch(`/api/decks/${deckId}`, {
    method: "PATCH",
    user,
    body: JSON.stringify(payload),
  });

  return readJsonResponse(response, "Unable to update this deck.");
}
