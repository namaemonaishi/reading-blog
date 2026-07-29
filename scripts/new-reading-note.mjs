import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readingDir = path.join(root, "src", "pages", "reading");
const templateDir = path.join(root, "templates");

const templates = {
  daily: { file: "daily-reading.md" },
  deep: { file: "deep-reading.md" },
  digest: { file: "link-digest.md" },
};

const aliases = {
  "1": "daily",
  "2": "deep",
  "3": "digest",
  d: "daily",
  daily: "daily",
  deep: "deep",
  digest: "digest",
};

function parseArgs(argv) {
  const args = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      positionals.push(current);
      continue;
    }

    const [rawKey, inlineValue] = current.slice(2).split("=");
    const key = rawKey === "url" ? "sourceUrl" : rawKey;
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    index += 1;
  }

  if (positionals.length > 0) {
    const first = positionals[0].toLowerCase();
    if (!args.template && aliases[first]) {
      args.template = positionals.shift();
    }

    const positionalKeys = [
      "title",
      "date",
      "slug",
      "description",
      "source",
      "sourceUrl",
      "author",
      "tags",
      "mood",
    ];

    for (const [index, key] of positionalKeys.entries()) {
      args[key] ??= positionals[index];
    }
  }

  return args;
}

function today() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function yamlString(value) {
  return JSON.stringify(String(value ?? "").trim());
}

function parseTags(value) {
  return String(value ?? "")
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function tagList(value) {
  return JSON.stringify(parseTags(value));
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function uniqueFilePath(date, slug) {
  let count = 1;
  let filePath = path.join(readingDir, `${date}-${slug}.md`);

  while (await exists(filePath)) {
    count += 1;
    filePath = path.join(readingDir, `${date}-${slug}-${count}.md`);
  }

  return filePath;
}

function render(template, values) {
  return template
    .replaceAll("{{title}}", yamlString(values.title))
    .replaceAll("{{description}}", yamlString(values.description))
    .replaceAll("{{date}}", yamlString(values.date))
    .replaceAll("{{source}}", yamlString(values.source))
    .replaceAll("{{sourceUrl}}", yamlString(values.sourceUrl))
    .replaceAll("{{author}}", yamlString(values.author))
    .replaceAll("{{tags}}", tagList(values.tags))
    .replaceAll("{{mood}}", yamlString(values.mood));
}

function showHelp() {
  console.log(`
用法：
  npm run new
  node scripts/new-reading-note.mjs --template daily --title "文章标题" --url "https://example.com"

模板：
  daily   日常阅读
  deep    深度阅读
  digest  链接速记
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    showHelp();
    return;
  }

  const rl = createInterface({ input, output });
  const ask = async (key, question, fallback = "") => {
    if (args[key] !== undefined) return String(args[key]).trim();
    const suffix = fallback ? ` (${fallback})` : "";
    const answer = await rl.question(`${question}${suffix}: `);
    return answer.trim() || fallback;
  };

  try {
    console.log("选择模板：");
    console.log("  1. daily  日常阅读  - 读完一篇文章后的标准记录");
    console.log("  2. deep   深度阅读  - 拆论点、证据和行动");
    console.log("  3. digest 链接速记  - 快速保存链接和三点收获");

    const templateInput = (await ask("template", "模板", "daily")).toLowerCase();
    const templateKey = aliases[templateInput];
    if (!templateKey) {
      throw new Error(`未知模板：${templateInput}`);
    }

    const title = await ask("title", "文章标题");
    if (!title) {
      throw new Error("文章标题不能为空。");
    }

    const date = await ask("date", "日期", today());
    const slugDefault = slugify(title) || "reading-note";
    const slug = slugify(await ask("slug", "文件短名，建议英文或拼音", slugDefault)) || slugDefault;
    const description = await ask("description", "一句话摘要", "这篇文章值得保存的一点。");
    const source = await ask("source", "文章来源", "");
    const sourceUrl = await ask("sourceUrl", "原文链接", "");
    const author = await ask("author", "作者", "");
    const tags = await ask("tags", "标签，用逗号分隔", "阅读");
    const mood = await ask("mood", "读后短评", "");

    const templatePath = path.join(templateDir, templates[templateKey].file);
    const template = await readFile(templatePath, "utf8");
    const filePath = await uniqueFilePath(date, slug);
    const content = render(template, {
      title,
      description,
      date,
      source,
      sourceUrl,
      author,
      tags,
      mood,
    });

    await mkdir(readingDir, { recursive: true });
    await writeFile(filePath, content, "utf8");

    console.log("");
    console.log(`已创建：${path.relative(root, filePath)}`);
    console.log("现在打开这个文件，继续写正文即可。");
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
