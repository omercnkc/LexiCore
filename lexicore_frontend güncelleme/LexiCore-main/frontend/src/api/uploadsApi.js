import { authorizedFetch, readJsonResponse } from "./apiClient";

export const uploadFile = async (user, file) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await authorizedFetch("/api/uploads", {
        user,
        method: "POST",
        body: formData,
    });
    return readJsonResponse(response, "Failed to upload file");
};

export const extractTerms = async (user, uploadId) => {
    const response = await authorizedFetch(`/api/uploads/${uploadId}/extract`, {
        user,
        method: "POST",
    });
    return readJsonResponse(response, "Failed to extract terms");
};

export const generateCards = async (user, uploadId, payload) => {
    const response = await authorizedFetch(`/api/uploads/${uploadId}/generate-cards`, {
        user,
        method: "POST",
        body: JSON.stringify(payload),
    });
    return readJsonResponse(response, "Failed to generate cards");
};
