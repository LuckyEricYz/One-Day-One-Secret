import type { GenerateRequestPayload, GenerateResponse, GenerateSuccessResponse } from "../types";

export async function generateTianji(payload: GenerateRequestPayload): Promise<GenerateResponse> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = (await response.json()) as GenerateResponse;
  return data;
}

export function isGenerateSuccess(
  response: GenerateResponse
): response is GenerateSuccessResponse {
  return response.success;
}

