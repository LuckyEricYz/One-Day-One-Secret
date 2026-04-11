import { generateTianji } from "../src/server/generate-service";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "Only POST is allowed."
      }
    });
    return;
  }

  const result = await generateTianji(req.body);
  const status = result.success ? 200 : result.error.code === "RATE_LIMIT_EXCEEDED" ? 429 : result.error.code === "INVALID_INPUT" || result.error.code === "PRESS_TOO_SHORT" ? 400 : 500;
  res.status(status).json(result);
}

