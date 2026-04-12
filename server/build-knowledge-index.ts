import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadDevEnv } from "../src/server/env.js";
import {
  createKnowledgeEmbeddingIndex,
  serializeKnowledgeEmbeddingIndex
} from "../src/server/rag.js";

async function main() {
  const loadedEnv = loadDevEnv();
  const index = await createKnowledgeEmbeddingIndex(loadedEnv.env);
  const outputPath = path.resolve(process.cwd(), "src/server/knowledge-index.generated.ts");

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serializeKnowledgeEmbeddingIndex(index), "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        source: loadedEnv.source,
        outputPath,
        strategy: index.strategy,
        itemCount: index.itemCount,
        dimension: index.dimension,
        model: index.model,
        generatedAt: index.generatedAt
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      null,
      2
    )
  );
  process.exit(1);
});
