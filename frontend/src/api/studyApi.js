import { authorizedFetch, readJsonResponse } from "./apiClient";

export async function fetchStudyQueue(user, deckId) {
  let endpoint = `/api/decks/${deckId}/study`;
  if (deckId.startsWith("course-")) {
    const courseName = deckId.substring("course-".length);
    endpoint = `/api/decks/courses/${encodeURIComponent(courseName)}/study`;
  }
  const response = await authorizedFetch(endpoint, {
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
