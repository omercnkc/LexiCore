import { authorizedFetch, readJsonResponse } from "./apiClient";

export async function fetchDashboardSummary(user) {
  const response = await authorizedFetch("/api/dashboard/summary", {
    user,
  });

  return readJsonResponse(response, "Unable to load dashboard summary.");
}

export async function fetchWeeklyProgress(user) {
  const response = await authorizedFetch("/api/dashboard/weekly-progress", {
    user,
  });

  return readJsonResponse(response, "Unable to load weekly progress.");
}
