import http from "node:http";

import { createServer as createViteServer } from "vite";

import { generateTianji } from "../src/server/generate-service";

const PORT = Number(process.env.PORT || 5173);

async function main() {
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
          const result = await generateTianji(parsed);
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

  server.listen(PORT, "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`Dev server running at http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
