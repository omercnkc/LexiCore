import { authorizedFetch, readJsonResponse } from "./apiClient";

export async function fetchMe(user) {
  const response = await authorizedFetch("/api/users/me", {
    user,
  });

  return readJsonResponse(response, "Unable to verify authenticated user with backend.");
}
