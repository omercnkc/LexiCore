import { authorizedFetch, readJsonResponse } from "./apiClient";

export async function fetchDeckCards(user, deckId) {
  const response = await authorizedFetch(`/api/decks/${deckId}/cards`, {
    user,
  });
  return readJsonResponse(response, "Failed to fetch cards.");
}

export async function createCard(user, deckId, cardData) {
  const response = await authorizedFetch(`/api/decks/${deckId}/cards`, {
    user,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cardData),
  });
  return readJsonResponse(response, "Failed to create card.");
}

export async function updateCard(user, cardId, cardData) {
  const response = await authorizedFetch(`/api/cards/${cardId}`, {
    user,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cardData),
  });
  return readJsonResponse(response, "Failed to update card.");
}

export async function deleteCard(user, cardId) {
  const response = await authorizedFetch(`/api/cards/${cardId}`, {
    user,
    method: "DELETE",
  });
  
  if (!response.ok) {
    throw new Error("Failed to delete card.");
  }
  
  // 204 No Content
  return true;
}

export async function checkAnswer(user, cardId, userAnswer) {
  const response = await authorizedFetch(`/api/cards/${cardId}/check-answer`, {
    user,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_answer: userAnswer }),
  });
  return readJsonResponse(response, "Failed to check answer.");
}

