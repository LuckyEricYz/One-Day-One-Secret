import http from "node:http";

import { createServer as createViteServer } from "vite";

import { loadDevEnv } from "../src/server/env";
import { generateTianji } from "../src/server/generate-service";

async function main() {
  const loadedEnv = loadDevEnv();
  const port = Number(loadedEnv.env.PORT || 5173);

  if (loadedEnv.source === "env.local") {
    console.info(`[dev] loaded defaults from ${loadedEnv.filePath}`);
  } else if (loadedEnv.source === "shell") {
    console.info("[dev] using shell environment fallback because .env.local was not found");
  } else {
    console.info("[dev] no local AI credentials found; requests will fall back");
  }

  const vite = await createViteServer({
    server: {
      middlewareMode: true
    },
    appType: "spa"
  });

  const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/api/generate") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });

      req.on("end", async () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          const result = await generateTianji(parsed, loadedEnv.env);
          const status = result.success
            ? 200
            : result.error.code === "RATE_LIMIT_EXCEEDED"
              ? 429
              : result.error.code === "INVALID_INPUT" ||
                  result.error.code === "PRESS_TOO_SHORT"
                ? 400
                : 500;
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: false,
              error: {
                code: "INTERNAL_ERROR",
                message: "开发服务器处理请求失败。"
              }
            })
          );
        }
      });
      return;
    }

    vite.middlewares(req, res, (error: unknown) => {
      if (error) {
        res.statusCode = 500;
        res.end(String(error));
      }
    });
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`Dev server running at http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
