import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  PermissionDeniedError
} from "openai";

import { OPENAI_TIANJI_RESPONSE_SCHEMA } from "./validate";

export type ProviderName = "openai" | "gemini" | "kimi";
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
  kimiApiKey?: string;
  kimiModel?: string;
  kimiBaseUrl?: string;
  geminiApiKey?: string;
  geminiModel?: string;
};

export type ProviderAttemptLog = {
  provider: ProviderName;
  model: string;
  latencyMs: number;
  status: "success" | "error";
  statusCode?: number;
  providerRequestId?: string;
  errorType?: ProviderErrorType;
  errorSummary?: string;
};

export type ProviderSuccess = {
  provider: ProviderName;
  model: string;
  payload: unknown;
  latencyMs: number;
  statusCode: number;
  providerRequestId?: string;
};

type FetchJsonResponse = {
  statusCode: number;
  latencyMs: number;
  body: unknown;
};

// Keep upstream waits short so Vercel can return a local fallback instead of dying on slow providers.
const REQUEST_TIMEOUT_MS = 4_000;

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
  providerRequestId?: string;
  summary: string;

  constructor(input: {
    provider: ProviderName;
    model: string;
    latencyMs: number;
    errorType: ProviderErrorType;
    message: string;
    statusCode?: number;
    providerRequestId?: string;
    summary?: string;
  }) {
    super(input.message);
    this.name = "ProviderError";
    this.provider = input.provider;
    this.model = input.model;
    this.latencyMs = input.latencyMs;
    this.errorType = input.errorType;
    this.statusCode = input.statusCode;
    this.providerRequestId = input.providerRequestId;
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
  if (provider === "kimi") return config.kimiModel ?? "kimi-for-coding";
  return config.geminiModel ?? "gemini-2.5-flash";
}

function getApiKeyForProvider(provider: ProviderName, config: ProviderConfig): string | undefined {
  if (provider === "openai") return config.openAiApiKey;
  if (provider === "kimi") return config.kimiApiKey;
  return config.geminiApiKey;
}

function normalizeOpenAiCompatibleBaseUrl(rawBaseUrl: string): string {
  const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/u, "");

  if (normalizedBaseUrl.endsWith("/chat/completions")) {
    return normalizedBaseUrl.slice(0, -"/chat/completions".length);
  }

  if (normalizedBaseUrl.endsWith("/responses")) {
    return normalizedBaseUrl.slice(0, -"/responses".length);
  }

  return normalizedBaseUrl;
}

function getOpenAiBaseUrl(config: ProviderConfig): string {
  return normalizeOpenAiCompatibleBaseUrl(config.openAiBaseUrl?.trim() || "https://api.openai.com/v1");
}

function getKimiBaseUrl(config: ProviderConfig): string {
  return normalizeOpenAiCompatibleBaseUrl(config.kimiBaseUrl?.trim() || "https://api.kimi.com/coding/v1");
}

function toSdkProviderError(
  provider: "openai" | "kimi",
  error: unknown,
  model: string,
  latencyMs: number
): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }

  if (error instanceof APIConnectionTimeoutError) {
    return new ProviderError({
      provider,
      model,
      latencyMs,
      errorType: "timeout",
      message: "Provider request timed out.",
      summary: error.message
    });
  }

  if (error instanceof APIConnectionError) {
    return new ProviderError({
      provider,
      model,
      latencyMs,
      errorType: "network",
      message: "Provider request failed before receiving a response.",
      summary: error.message
    });
  }

  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
    return new ProviderError({
      provider,
      model,
      latencyMs,
      statusCode: error.status,
      providerRequestId: error.requestID ?? undefined,
      errorType: "auth",
      message: error.message,
      summary: summarizeUnknown(error.error ?? error.message)
    });
  }

  if (error instanceof APIError) {
    return new ProviderError({
      provider,
      model,
      latencyMs,
      statusCode: error.status,
      providerRequestId: error.requestID ?? undefined,
      errorType: typeof error.status === "number" ? classifyHttpError(error.status) : "http",
      message: error.message,
      summary: summarizeUnknown(error.error ?? error.message)
    });
  }

  return new ProviderError({
    provider,
    model,
    latencyMs,
    errorType: "network",
    message: (error as Error).message || `${provider} request failed unexpectedly.`,
    summary: (error as Error).message || `${provider} request failed unexpectedly.`
  });
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
  const client = new OpenAI({
    apiKey,
    baseURL: getOpenAiBaseUrl(config),
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 0
  });
  const startTime = Date.now();

  let response;
  try {
    response = await client.responses
      .create({
        model,
        instructions: systemPrompt,
        input: userPrompt,
        temperature: 0.7,
        text: {
          format: {
            type: "json_schema",
            name: "tianji_card",
            description: "Structured output for the Tianji daily lifestyle advice card.",
            strict: true,
            schema: OPENAI_TIANJI_RESPONSE_SCHEMA
          }
        }
      })
      .withResponse();
  } catch (error) {
    throw toSdkProviderError("openai", error, model, getElapsedMs(startTime));
  }

  const latencyMs = getElapsedMs(startTime);
  const text = response.data.output_text.trim();
  if (!text) {
    throw new ProviderError({
      provider: "openai",
      model,
      latencyMs,
      statusCode: response.response.status,
      providerRequestId: response.request_id ?? undefined,
      errorType: "parse",
      message: "OpenAI returned empty content.",
      summary: summarizeUnknown(response.data)
    });
  }

  const payload = tryParseJson(text);
  if (payload === null) {
    throw new ProviderError({
      provider: "openai",
      model,
      latencyMs,
      statusCode: response.response.status,
      providerRequestId: response.request_id ?? undefined,
      errorType: "parse",
      message: "OpenAI content was not valid JSON.",
      summary: summarizeText(text)
    });
  }

  return {
    provider: "openai",
    model,
    payload,
    latencyMs,
    statusCode: response.response.status,
    providerRequestId: response.request_id ?? undefined
  };
}

async function callKimi(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<ProviderSuccess> {
  const { apiKey, model } = ensureProviderReady("kimi", config);
  const client = new OpenAI({
    apiKey,
    baseURL: getKimiBaseUrl(config),
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 0
  });
  const startTime = Date.now();

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });
  } catch (error) {
    throw toSdkProviderError("kimi", error, model, getElapsedMs(startTime));
  }

  const latencyMs = getElapsedMs(startTime);
  const content = completion.choices[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";

  if (!text) {
    throw new ProviderError({
      provider: "kimi",
      model,
      latencyMs,
      statusCode: 200,
      providerRequestId: completion._request_id ?? undefined,
      errorType: "parse",
      message: "Kimi returned empty content.",
      summary: summarizeUnknown(completion)
    });
  }

  const payload = tryParseJson(text);
  if (payload === null) {
    throw new ProviderError({
      provider: "kimi",
      model,
      latencyMs,
      statusCode: 200,
      providerRequestId: completion._request_id ?? undefined,
      errorType: "parse",
      message: "Kimi content was not valid JSON.",
      summary: summarizeText(text)
    });
  }

  return {
    provider: "kimi",
    model,
    payload,
    latencyMs,
    statusCode: 200,
    providerRequestId: completion._request_id ?? undefined
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

  if (preference === "kimi") {
    return ["kimi"];
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
  let result: ProviderSuccess;

  if (provider === "openai") {
    result = await callOpenAI(config, systemPrompt, userPrompt);
  } else if (provider === "kimi") {
    result = await callKimi(config, systemPrompt, userPrompt);
  } else {
    result = await callGemini(config, systemPrompt, userPrompt);
  }

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
    providerRequestId: error.providerRequestId,
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
