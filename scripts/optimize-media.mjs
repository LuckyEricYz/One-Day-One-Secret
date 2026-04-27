import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ffmpegPath from "ffmpeg-static";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const jobs = [
  {
    source: "src/public/boy.mov",
    video: "public/roles/role_a.webm",
    poster: "public/roles/role_a-poster.webp",
    scale: "512:-2",
    crf: "34"
  },
  {
    source: "src/public/girl.mov",
    video: "public/roles/role_b.webm",
    poster: "public/roles/role_b-poster.webp",
    scale: "512:-2",
    crf: "34"
  },
  {
    source: "src/public/health2.mov",
    video: "public/health/health-2.webm",
    poster: "public/health/health-2-poster.webp",
    scale: "720:-2",
    crf: "36"
  },
  {
    source: "src/public/health3.mov",
    video: "public/health/health-3.webm",
    poster: "public/health/health-3-poster.webp",
    scale: "720:-2",
    crf: "36"
  },
  {
    source: "src/public/health4.mov",
    video: "public/health/health-4.webm",
    poster: "public/health/health-4-poster.webp",
    scale: "720:-2",
    crf: "36"
  }
];

function runFfmpeg(args) {
  const result = spawnSync(ffmpegPath, args, {
    cwd: rootDir,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`ffmpeg failed with status ${result.status ?? "unknown"}`);
  }
}

function ensureParent(filePath) {
  mkdirSync(path.dirname(path.join(rootDir, filePath)), { recursive: true });
}

for (const job of jobs) {
  const sourcePath = path.join(rootDir, job.source);
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing source media: ${job.source}`);
  }

  ensureParent(job.video);
  ensureParent(job.poster);

  const videoFilter = `scale=${job.scale}:force_original_aspect_ratio=decrease,fps=24`;

  runFfmpeg([
    "-y",
    "-i",
    job.source,
    "-vf",
    videoFilter,
    "-an",
    "-c:v",
    "libvpx-vp9",
    "-b:v",
    "0",
    "-crf",
    job.crf,
    "-deadline",
    "good",
    "-cpu-used",
    "4",
    "-row-mt",
    "1",
    "-auto-alt-ref",
    "0",
    job.video
  ]);

  runFfmpeg([
    "-y",
    "-i",
    job.source,
    "-frames:v",
    "1",
    "-vf",
    `scale=${job.scale}:force_original_aspect_ratio=decrease`,
    "-q:v",
    "70",
    job.poster
  ]);
}
