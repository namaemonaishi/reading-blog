import { readFile } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readingDir = path.join(root, "src", "pages", "reading");
const args = new Set(process.argv.slice(2));
const mode = args.has("--once") ? "once" : "watch";
const debounceMs = Number(optionValue("--debounce", "2500"));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function shellFor(command) {
  return process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
}

let running = false;
let rerunRequested = false;
let timer = null;

function optionValue(name, fallback) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = process.argv.indexOf(name);
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) {
    return process.argv[index + 1];
  }

  return fallback;
}

function showHelp() {
  console.log(`
用法：
  npm run watch:push       持续监听 reading 文件夹，有可发布文章就自动推送
  npm run publish:pending  只扫描一次，把当前可发布文章推送上去

发布规则：
  - 只处理 src/pages/reading 里的 .md 文件
  - 文件名不能以下划线开头
  - frontmatter 里必须写 draft: false
  - 提交前会先运行 npm run build，构建失败就不会推送
`);
}

function output(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: root,
      shell: shellFor(command),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      const detail = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
      reject(new Error(detail || `${command} ${commandArgs.join(" ")} failed with code ${code}`));
    });
  });
}

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: root,
      shell: shellFor(command),
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${commandArgs.join(" ")} failed with code ${code}`));
    });
  });
}

function normalizeRel(filePath) {
  return filePath.replaceAll("\\", "/");
}

function parseGitPath(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"')) return trimmed;

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed.slice(1, -1);
  }
}

function statusPath(line) {
  if (!line.trim()) return null;

  const match = line.match(/^\s*(?:[ MADRCU?!]{1,2})\s+(.+)$/);
  const rawPath = (match?.[1] ?? line).trim();
  const targetPath = rawPath.includes(" -> ") ? rawPath.split(" -> ").pop() : rawPath;
  return normalizeRel(parseGitPath(targetPath));
}

function isReadingMarkdown(relPath) {
  const normalized = normalizeRel(relPath);
  return normalized.startsWith("src/pages/reading/") && normalized.endsWith(".md");
}

function basename(relPath) {
  return path.posix.basename(normalizeRel(relPath));
}

function frontmatterOf(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match?.[1] ?? "";
}

function hasDraftFalse(frontmatter) {
  return /^draft:\s*false\s*$/im.test(frontmatter);
}

function titleFrom(frontmatter, relPath) {
  const match = frontmatter.match(/^title:\s*(.+?)\s*$/im);
  if (!match) return path.posix.basename(normalizeRel(relPath), ".md");

  const raw = match[1].trim();
  try {
    const parsed = JSON.parse(raw);
    return String(parsed).trim() || path.posix.basename(normalizeRel(relPath), ".md");
  } catch {
    return raw.replace(/^['"]|['"]$/g, "").trim() || path.posix.basename(normalizeRel(relPath), ".md");
  }
}

async function publishableStatusFiles() {
  const status = await output("git", ["status", "--porcelain", "--", "src/pages/reading"]);
  const candidates = [...new Set(status.split(/\r?\n/).map(statusPath).filter(Boolean))]
    .filter(isReadingMarkdown)
    .filter((relPath) => !basename(relPath).startsWith("_"));

  const publishable = [];
  const skipped = [];

  for (const relPath of candidates) {
    const fullPath = path.join(root, ...normalizeRel(relPath).split("/"));
    try {
      const content = await readFile(fullPath, "utf8");
      const frontmatter = frontmatterOf(content);
      if (!hasDraftFalse(frontmatter)) {
        skipped.push(`${relPath}（不是 draft: false）`);
        continue;
      }

      publishable.push({ relPath, title: titleFrom(frontmatter, relPath) });
    } catch (error) {
      skipped.push(`${relPath}（无法读取：${error.message}）`);
    }
  }

  return { publishable, skipped };
}

async function ensureNoStagedFiles() {
  const staged = await output("git", ["diff", "--cached", "--name-only"]);
  if (!staged) return;

  throw new Error(`已经有暂存区文件，自动发布先暂停，避免一起提交：\n${staged}`);
}

function commitMessageFor(items) {
  if (items.length === 1) {
    const title = items[0].title.replace(/\s+/g, " ").slice(0, 80);
    return `Publish reading note: ${title}`;
  }

  return `Publish ${items.length} reading notes`;
}

async function currentBranch() {
  return (await output("git", ["branch", "--show-current"])) || "main";
}

async function publishPending(reason = "扫描") {
  console.log(`\n[reading-push] ${reason}`);

  await ensureNoStagedFiles();
  const { publishable, skipped } = await publishableStatusFiles();

  for (const item of skipped) {
    console.log(`[reading-push] 跳过：${item}`);
  }

  if (publishable.length === 0) {
    console.log("[reading-push] 没有发现可发布的新文章。");
    return false;
  }

  console.log(`[reading-push] 准备发布 ${publishable.length} 篇文章：`);
  for (const item of publishable) {
    console.log(`  - ${item.relPath}`);
  }

  console.log("[reading-push] 先检查网站能否正常构建...");
  await run(npmCommand, ["run", "build"]);

  const files = publishable.map((item) => item.relPath);
  await run("git", ["add", "--", ...files]);

  const staged = await output("git", ["diff", "--cached", "--name-only", "--", ...files]);
  if (!staged) {
    console.log("[reading-push] 没有需要提交的文章变更。");
    return false;
  }

  const message = commitMessageFor(publishable);
  await run("git", ["commit", "-m", message]);
  await run("git", ["push", "origin", await currentBranch()]);

  console.log("[reading-push] 已推送，GitHub Pages 会自动发布。");
  return true;
}

async function runQueued(reason) {
  if (running) {
    rerunRequested = true;
    return;
  }

  running = true;
  try {
    do {
      rerunRequested = false;
      await publishPending(reason);
      reason = "继续扫描";
    } while (rerunRequested);
  } catch (error) {
    console.error(`[reading-push] 发布失败：${error.message}`);
    if (mode === "once") process.exitCode = 1;
  } finally {
    running = false;
  }
}

function schedule(reason) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    void runQueued(reason);
  }, debounceMs);
}

async function main() {
  if (args.has("--help") || args.has("-h")) {
    showHelp();
    return;
  }

  if (mode === "once") {
    await runQueued("手动扫描");
    return;
  }

  console.log("[reading-push] 自动发布监听已启动。按 Ctrl+C 停止。");
  console.log("[reading-push] 发布条件：文件名不以 _ 开头，并且 frontmatter 里是 draft: false。");
  await runQueued("启动扫描");

  const watcher = watch(readingDir, (eventType, filename) => {
    if (!filename || !String(filename).endsWith(".md")) return;
    schedule(`${eventType}: ${filename}`);
  });

  process.on("SIGINT", () => {
    watcher.close();
    console.log("\n[reading-push] 已停止监听。");
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(`[reading-push] ${error.message}`);
  process.exitCode = 1;
});


