import { authorizedFetch, readJsonResponse } from "./apiClient";

export async function fetchStudyQueue(user, deckId) {
  const response = await authorizedFetch(`/api/decks/${deckId}/study`, {
    user,
  });
  return readJsonResponse(response, "Failed to fetch study queue.");
}

export async function submitCardReview(user, cardId, rating, answerData = {}) {
  const response = await authorizedFetch(`/api/cards/${cardId}/review`, {
    user,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rating, ...answerData }),
  });
  return readJsonResponse(response, "Failed to submit review.");
}
