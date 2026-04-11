import { execFileSync } from "node:child_process";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
    ...options
  }).trim();
}

function runStreaming(command, args) {
  execFileSync(command, args, {
    stdio: "inherit"
  });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function normalizeIssue(rawIssue) {
  const normalized = rawIssue.replace(/^#/, "");
  if (!/^\d+$/.test(normalized)) {
    fail("Issue 号必须是纯数字，例如 `pnpm ship -- 123`。");
  }

  return normalized;
}

function classifyCommitType(files) {
  if (files.length > 0 && files.every((file) => file.startsWith("docs/") || file === "README.md")) {
    return "docs";
  }

  if (
    files.some((file) =>
      [
        "api/",
        "src/",
        "server/",
        "vercel.json",
        ".github/workflows/"
      ].some((prefix) => file.startsWith(prefix) || file === prefix)
    )
  ) {
    return "fix";
  }

  return "chore";
}

function inferSummary(files) {
  if (files.length === 0) {
    return "apply current changes";
  }

  if (files.length === 1) {
    const [file] = files;
    if (file === "api/generate.ts") return "fix vercel api handler";
    if (file.startsWith(".github/workflows/")) return "update ci workflow";
    if (file.startsWith("docs/")) return "update docs";

    const baseName = file
      .replace(/\.[^.]+$/u, "")
      .split("/")
      .slice(-2)
      .join(" ");
    return `update ${baseName}`;
  }

  if (files.every((file) => file.startsWith("docs/") || file === "README.md")) {
    return "update docs";
  }

  if (files.some((file) => file.startsWith("api/"))) {
    return "update api flow";
  }

  if (files.some((file) => file.startsWith("src/server/"))) {
    return "update server generation flow";
  }

  if (files.some((file) => file.startsWith(".github/workflows/"))) {
    return "update automation flow";
  }

  return "apply current changes";
}

function hasUpstream() {
  try {
    run("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
    return true;
  } catch {
    return false;
  }
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("用法：pnpm ship -- <issue号> [可选提交摘要] [--no-check]");
  console.log("示例：pnpm ship -- 123 修复 vercel 自动发布");
  process.exit(0);
}

const noCheck = args.includes("--no-check");
const filteredArgs = args.filter((arg) => arg !== "--no-check");

if (filteredArgs.length === 0) {
  fail("用法：`pnpm ship -- <issue号> [可选提交摘要] [--no-check]`");
}

const issue = normalizeIssue(filteredArgs[0]);
const summaryFromArgs = filteredArgs.slice(1).join(" ").trim();
const branch = run("git", ["branch", "--show-current"]);

if (!branch) {
  fail("未能识别当前 git 分支。");
}

const workingTreeStatus = run("git", ["status", "--porcelain"]);
if (!workingTreeStatus) {
  fail("当前工作区没有可提交的变更。");
}

if (!noCheck) {
  runStreaming("pnpm", ["check"]);
}

runStreaming("git", ["add", "-A"]);

const stagedFiles = run("git", ["diff", "--cached", "--name-only"])
  .split("\n")
  .map((file) => file.trim())
  .filter(Boolean);

if (stagedFiles.length === 0) {
  fail("没有可提交的已暂存文件。");
}

const commitType = classifyCommitType(stagedFiles);
const summary = summaryFromArgs || inferSummary(stagedFiles);
const commitMessage = `${commitType}(#${issue}): ${summary}`;

runStreaming("git", ["commit", "-m", commitMessage]);

if (hasUpstream()) {
  runStreaming("git", ["push"]);
} else {
  runStreaming("git", ["push", "-u", "origin", branch]);
}

console.log(`已推送 ${branch}: ${commitMessage}`);
