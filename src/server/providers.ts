type ProviderConfig = {
  openAiApiKey?: string;
  openAiModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
};

type ProviderResult = {
  provider: string;
  payload: unknown;
};

const REQUEST_TIMEOUT_MS = 15_000;

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<ProviderResult> {
  if (!config.openAiApiKey) {
    throw new Error("Missing OpenAI API key.");
  }

  const data = (await fetchJson("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.openAiModel ?? "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  })) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("OpenAI returned empty content.");
  }

  return {
    provider: "openai",
    payload: JSON.parse(text)
  };
}

async function callGemini(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<ProviderResult> {
  if (!config.geminiApiKey) {
    throw new Error("Missing Gemini API key.");
  }

  const model = config.geminiModel ?? "gemini-2.5-flash";
  const data = (await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`,
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
  )) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned empty content.");
  }

  return {
    provider: "gemini",
    payload: JSON.parse(text)
  };
}

export async function generateWithProviders(
  preferredProvider: string | undefined,
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<ProviderResult> {
  const order =
    preferredProvider === "gemini"
      ? ["gemini", "openai"]
      : ["openai", "gemini"];

  const errors: string[] = [];

  for (const provider of order) {
    try {
      if (provider === "openai") {
        return await callOpenAI(config, systemPrompt, userPrompt);
      }
      return await callGemini(config, systemPrompt, userPrompt);
    } catch (error) {
      errors.push(`${provider}: ${(error as Error).message}`);
    }
  }

  throw new Error(errors.join("; "));
}

