import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type ServerEnv = Record<string, string | undefined>;

export type DevEnvLoadResult = {
  env: ServerEnv;
  source: "env.local" | "shell" | "none";
  filePath: string;
};

function parseDotEnv(content: string): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

export function loadDevEnv(cwd = process.cwd(), baseEnv: ServerEnv = process.env): DevEnvLoadResult {
  const filePath = path.join(cwd, ".env.local");

  if (existsSync(filePath)) {
    const fileEnv = parseDotEnv(readFileSync(filePath, "utf8"));
    return {
      env: { ...fileEnv, ...baseEnv },
      source: "env.local",
      filePath
    };
  }

  const source =
    baseEnv.OPENAI_API_KEY || baseEnv.GEMINI_API_KEY || baseEnv.AI_PROVIDER ? "shell" : "none";

  return {
    env: { ...baseEnv },
    source,
    filePath
  };
}
