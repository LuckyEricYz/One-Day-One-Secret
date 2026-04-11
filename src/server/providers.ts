export type ProviderName = "openai" | "gemini";
export type ProviderPreference = ProviderName | "auto" | "fallback";
export type ProviderErrorType =
  | "auth"
  | "network"
  | "timeout"
  | "http"
  | "parse"
  | "schema"
  | "provider_unavailable";

export type ProviderConfig = {
  openAiApiKey?: string;
  openAiModel?: string;
  openAiBaseUrl?: string;
  geminiApiKey?: string;
  geminiModel?: string;
};

export type ProviderAttemptLog = {
  provider: ProviderName;
  model: string;
  latencyMs: number;
  status: "success" | "error";
  statusCode?: number;
  errorType?: ProviderErrorType;
  errorSummary?: string;
};

export type ProviderSuccess = {
  provider: ProviderName;
  model: string;
  payload: unknown;
  latencyMs: number;
  statusCode: number;
};

type FetchJsonResponse = {
  statusCode: number;
  latencyMs: number;
  body: unknown;
};

const REQUEST_TIMEOUT_MS = 15_000;

function summarizeText(input: string): string {
  return input.replace(/\s+/gu, " ").trim().slice(0, 180);
}

function summarizeUnknown(input: unknown): string {
  if (typeof input === "string") {
    return summarizeText(input);
  }

  try {
    return summarizeText(JSON.stringify(input));
  } catch {
    return "Unable to summarize provider response.";
  }
}

function classifyHttpError(statusCode: number): ProviderErrorType {
  if (statusCode === 401 || statusCode === 403) {
    return "auth";
  }
  return "http";
}

export class ProviderError extends Error {
  provider: ProviderName;
  model: string;
  latencyMs: number;
  errorType: ProviderErrorType;
  statusCode?: number;
  summary: string;

  constructor(input: {
    provider: ProviderName;
    model: string;
    latencyMs: number;
    errorType: ProviderErrorType;
    message: string;
    statusCode?: number;
    summary?: string;
  }) {
    super(input.message);
    this.name = "ProviderError";
    this.provider = input.provider;
    this.model = input.model;
    this.latencyMs = input.latencyMs;
    this.errorType = input.errorType;
    this.statusCode = input.statusCode;
    this.summary = summarizeText(input.summary ?? input.message);
  }
}

function getElapsedMs(startTime: number): number {
  return Math.max(1, Date.now() - startTime);
}

async function fetchJson(
  provider: ProviderName,
  model: string,
  url: string,
  init: RequestInit
): Promise<FetchJsonResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startTime = Date.now();

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    const body = text ? tryParseJson(text) ?? text : null;

    if (!response.ok) {
      throw new ProviderError({
        provider,
        model,
        latencyMs: getElapsedMs(startTime),
        statusCode: response.status,
        errorType: classifyHttpError(response.status),
        message: `Request failed with status ${response.status}.`,
        summary: summarizeUnknown(body)
      });
    }

    return {
      statusCode: response.status,
      latencyMs: getElapsedMs(startTime),
      body
    };
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }

    const latencyMs = getElapsedMs(startTime);
    if ((error as Error).name === "AbortError") {
      throw new ProviderError({
        provider,
        model,
        latencyMs,
        errorType: "timeout",
        message: "Provider request timed out.",
        summary: "Request exceeded timeout limit."
      });
    }

    throw new ProviderError({
      provider,
      model,
      latencyMs,
      errorType: "network",
      message: "Provider request failed before receiving a response.",
      summary: (error as Error).message || "Unknown network error."
    });
  } finally {
    clearTimeout(timeout);
  }
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getModelForProvider(provider: ProviderName, config: ProviderConfig): string {
  if (provider === "openai") return config.openAiModel ?? "gpt-4o-mini";
  return config.geminiModel ?? "gemini-2.5-flash";
}

function getApiKeyForProvider(provider: ProviderName, config: ProviderConfig): string | undefined {
  if (provider === "openai") return config.openAiApiKey;
  return config.geminiApiKey;
}

function getOpenAiChatCompletionsUrl(config: ProviderConfig): string {
  const rawBaseUrl = config.openAiBaseUrl?.trim() || "https://api.openai.com/v1";
  const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/u, "");

  if (normalizedBaseUrl.endsWith("/chat/completions")) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}/chat/completions`;
}

function ensureProviderReady(provider: ProviderName, config: ProviderConfig): { apiKey: string; model: string } {
  const apiKey = getApiKeyForProvider(provider, config);
  const model = getModelForProvider(provider, config);

  if (!apiKey) {
    throw new ProviderError({
      provider,
      model,
      latencyMs: 0,
      errorType: "provider_unavailable",
      message: `Missing ${provider} API key.`,
      summary: `${provider} API key is not configured.`
    });
  }

  return { apiKey, model };
}

async function callOpenAI(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<ProviderSuccess> {
  const { apiKey, model } = ensureProviderReady("openai", config);
  const response = await fetchJson("openai", model, getOpenAiChatCompletionsUrl(config), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  const data = response.body as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new ProviderError({
      provider: "openai",
      model,
      latencyMs: response.latencyMs,
      statusCode: response.statusCode,
      errorType: "parse",
      message: "OpenAI returned empty content.",
      summary: summarizeUnknown(response.body)
    });
  }

  const payload = tryParseJson(text);
  if (payload === null) {
    throw new ProviderError({
      provider: "openai",
      model,
      latencyMs: response.latencyMs,
      statusCode: response.statusCode,
      errorType: "parse",
      message: "OpenAI content was not valid JSON.",
      summary: summarizeText(text)
    });
  }

  return {
    provider: "openai",
    model,
    payload,
    latencyMs: response.latencyMs,
    statusCode: response.statusCode
  };
}

async function callGemini(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<ProviderSuccess> {
  const { apiKey, model } = ensureProviderReady("gemini", config);
  const response = await fetchJson(
    "gemini",
    model,
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        },
        contents: [
          {
            parts: [
              {
                text: `${systemPrompt}\n\n${userPrompt}`
              }
            ]
          }
        ]
      })
    }
  );

  const data = response.body as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new ProviderError({
      provider: "gemini",
      model,
      latencyMs: response.latencyMs,
      statusCode: response.statusCode,
      errorType: "parse",
      message: "Gemini returned empty content.",
      summary: summarizeUnknown(response.body)
    });
  }

  const payload = tryParseJson(text);
  if (payload === null) {
    throw new ProviderError({
      provider: "gemini",
      model,
      latencyMs: response.latencyMs,
      statusCode: response.statusCode,
      errorType: "parse",
      message: "Gemini content was not valid JSON.",
      summary: summarizeText(text)
    });
  }

  return {
    provider: "gemini",
    model,
    payload,
    latencyMs: response.latencyMs,
    statusCode: response.statusCode
  };
}

export function getProviderOrder(preference: string | undefined): ProviderName[] {
  if (preference === "fallback") {
    return [];
  }

  if (preference === "gemini") {
    return ["gemini"];
  }

  if (preference === "openai") {
    return ["openai"];
  }

  // auto: openai → gemini
  return ["openai", "gemini"];
}

export async function callProvider(
  provider: ProviderName,
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<ProviderSuccess> {
  const startTime = Date.now();
  const result =
    provider === "openai"
      ? await callOpenAI(config, systemPrompt, userPrompt)
      : await callGemini(config, systemPrompt, userPrompt);

  return {
    ...result,
    latencyMs: getElapsedMs(startTime)
  };
}

export function toAttemptLog(error: ProviderError): ProviderAttemptLog {
  return {
    provider: error.provider,
    model: error.model,
    latencyMs: error.latencyMs,
    status: "error",
    statusCode: error.statusCode,
    errorType: error.errorType,
    errorSummary: error.summary
  };
}

export function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }

  return new ProviderError({
    provider: "openai",
    model: "unknown",
    latencyMs: 0,
    errorType: "network",
    message: (error as Error).message || "Unknown provider error.",
    summary: (error as Error).message || "Unknown provider error."
  });
}
