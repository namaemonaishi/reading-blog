import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readingDir = path.join(root, "src", "pages", "reading");
const dataDir = path.join(root, "data");
const statePath = path.join(dataDir, "zotero-imports.json");
const envPath = path.join(root, ".env");

const skipItemTypes = new Set(["attachment", "note", "annotation"]);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;

    const [rawKey, inlineValue] = current.slice(2).split("=");
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
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
  return args;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadDotEnv() {
  if (!(await fileExists(envPath))) return {};

  const env = {};
  const text = await readFile(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

function pick(...values) {
  return values.find((value) => value !== undefined && value !== "");
}

function bool(value) {
  return value === true || value === "true" || value === "1" || value === "yes";
}

function today() {
  const now = new Date();
  return formatDate(now);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return today();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function yamlString(value) {
  return JSON.stringify(String(value ?? "").trim());
}

function yamlArray(values) {
  return `[${values.map((value) => yamlString(value)).join(", ")}]`;
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summarize(value, fallback) {
  const text = cleanText(value);
  if (!text) return fallback;
  return text.length > 150 ? `${text.slice(0, 147)}...` : text;
}

function creatorName(creator) {
  if (creator.name) return creator.name;
  return [creator.firstName, creator.lastName].filter(Boolean).join(" ");
}

function authors(creators = []) {
  const names = creators
    .filter((creator) => ["author", "editor", "contributor"].includes(creator.creatorType))
    .map(creatorName)
    .filter(Boolean);
  return names.slice(0, 4).join("、");
}

function sourceFor(data) {
  return pick(
    data.publicationTitle,
    data.websiteTitle,
    data.blogTitle,
    data.bookTitle,
    data.proceedingsTitle,
    data.conferenceName,
    data.publisher,
    data.repository,
    data.libraryCatalog,
    data.itemType
  );
}

function sourceUrlFor(data) {
  if (data.url) return data.url;
  if (data.DOI) return `https://doi.org/${data.DOI}`;
  return "";
}

function tagsFor(data) {
  const zoteroTags = (data.tags ?? [])
    .map((tag) => tag.tag)
    .filter(Boolean)
    .filter((tag) => !tag.startsWith("_"));
  return [...new Set(["Zotero", ...zoteroTags])];
}

function slugify(value, fallback) {
  const slug = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || fallback.toLowerCase();
}

async function listMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(entryPath);
    }
  }

  return files;
}

async function existingZoteroKeys() {
  const keys = new Set();
  if (!(await fileExists(readingDir))) return keys;

  for (const file of await listMarkdownFiles(readingDir)) {
    const text = await readFile(file, "utf8");
    const match = text.match(/^zoteroKey:\s*["']?([A-Z0-9]+)["']?/m);
    if (match) keys.add(match[1]);
  }

  return keys;
}

async function loadState() {
  if (!(await fileExists(statePath))) {
    return { imported: {} };
  }

  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch {
    return { imported: {} };
  }
}

async function saveState(state) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function uniqueFilePath(fileName) {
  let count = 1;
  let filePath = path.join(readingDir, fileName);
  const extension = path.extname(fileName);
  const baseName = fileName.slice(0, -extension.length);

  while (await fileExists(filePath)) {
    count += 1;
    filePath = path.join(readingDir, `${baseName}-${count}${extension}`);
  }

  return filePath;
}

function mdBullet(label, value) {
  if (!value) return "";
  return `- ${label}: ${value}\n`;
}

function renderMarkdown(item, options) {
  const data = item.data ?? {};
  const title = data.title || data.shortTitle || `Zotero 条目 ${item.key}`;
  const dateAdded = data.dateAdded || new Date().toISOString();
  const pageDate = options.dateSource === "today" ? today() : formatDate(dateAdded);
  const source = sourceFor(data);
  const url = sourceUrlFor(data);
  const tagList = tagsFor(data);
  const authorText = authors(data.creators);
  const description = summarize(data.abstractNote, "从 Zotero 自动生成的阅读草稿，待补充摘要。");
  const publishedDate = data.date || "";
  const doi = data.DOI || "";

  return `---
layout: ../../layouts/ReadingLayout.astro
title: ${yamlString(title)}
description: ${yamlString(description)}
date: ${yamlString(pageDate)}
source: ${yamlString(source)}
sourceUrl: ${yamlString(url)}
author: ${yamlString(authorText)}
tags: ${yamlArray(tagList)}
mood: ${yamlString("从 Zotero 自动生成，待阅读/待整理")}
draft: ${options.publish ? "false" : "true"}
zoteroKey: ${yamlString(item.key)}
zoteroItemType: ${yamlString(data.itemType)}
zoteroDateAdded: ${yamlString(dateAdded)}
publishedDate: ${yamlString(publishedDate)}
---

## 原文信息

${mdBullet("标题", title)}${mdBullet("作者", authorText)}${mdBullet("来源", source)}${mdBullet("链接", url)}${mdBullet("DOI", doi)}${mdBullet("Zotero Key", item.key)}
## 一句话记住

这篇文章最值得保存的一点是什么？

## 摘录

> 这里放一小段你想保存的原文。尽量只摘真正有用的句子。

## 我的判断

- 我同意什么？
- 我怀疑什么？
- 它和我之前读过的内容有什么冲突或呼应？

## 可以继续追的问题

1. 这个观点有没有反例？
2. 它能不能用在我自己的项目或生活里？
3. 过一周再看，我还同意吗？

## 发布前检查

1. 把文件名开头的 \`_\` 删除。
2. 把 \`draft: true\` 改成 \`draft: false\`。
3. 补全正文后提交并推送。
`;
}

function endpoint(config, suffix) {
  const base = config.baseUrl.replace(/\/$/, "");
  const prefix = config.groupId ? `groups/${config.groupId}` : `users/${config.userId}`;
  return `${base}/${prefix}${suffix}`;
}

async function requestJson(url, config) {
  const headers = { "Zotero-API-Version": "3" };
  if (config.apiKey) headers["Zotero-API-Key"] = config.apiKey;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}: ${body || url}`);
  }

  return response.json();
}

async function resolveCollectionKey(config) {
  if (config.collectionKey) return config.collectionKey;
  if (!config.collectionName) return "";

  const url = endpoint(config, "/collections?format=json");
  const collections = await requestJson(url, config);
  const collection = collections.find((entry) => entry.data?.name === config.collectionName);
  if (!collection) {
    throw new Error(`没有找到 Zotero collection：${config.collectionName}`);
  }
  return collection.key;
}

async function fetchItems(config) {
  const collectionKey = await resolveCollectionKey(config);
  const pathPart = collectionKey
    ? `/collections/${collectionKey}/items/top`
    : "/items/top";
  const url = new URL(endpoint(config, pathPart));
  url.searchParams.set("format", "json");
  url.searchParams.set("sort", "dateAdded");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("limit", String(config.limit));

  return requestJson(url.toString(), config);
}

async function importOnce(config) {
  const state = await loadState();
  const existingKeys = await existingZoteroKeys();
  const items = await fetchItems(config);
  let created = 0;
  let skipped = 0;

  await mkdir(readingDir, { recursive: true });

  for (const item of items) {
    const data = item.data ?? {};
    if (!item.key || skipItemTypes.has(data.itemType)) {
      skipped += 1;
      continue;
    }

    if (!config.force && (state.imported[item.key] || existingKeys.has(item.key))) {
      skipped += 1;
      continue;
    }

    const date = config.dateSource === "today" ? today() : formatDate(data.dateAdded);
    const title = data.title || data.shortTitle || item.key;
    const slug = slugify(title, item.key);
    const prefix = config.publish ? "" : "_";
    const fileName = `${prefix}${date}-${slug}.md`;
    const filePath = await uniqueFilePath(fileName);
    const markdown = renderMarkdown(item, config);

    if (config.dryRun) {
      console.log(`[dry-run] ${path.relative(root, filePath)} <= ${title}`);
    } else {
      await writeFile(filePath, markdown, "utf8");
      console.log(`已生成：${path.relative(root, filePath)}`);
      state.imported[item.key] = {
        file: path.relative(root, filePath),
        title,
        version: item.version,
        importedAt: new Date().toISOString(),
      };
      created += 1;
    }
  }

  if (!config.dryRun) await saveState(state);
  console.log(`完成：新增 ${created} 篇，跳过 ${skipped} 条。`);
}

function showHelp() {
  console.log(`
用法：
  npm run zotero:import
  npm run zotero:watch

常用参数：
  --limit 10                    本次检查最近多少条 Zotero 条目
  --collection-name "Reading"   只同步某个 collection
  --collection ABCD1234         只同步某个 collection key
  --publish                     直接生成可发布文章，而不是 _ 开头的草稿
  --dry-run                     只预览会生成什么文件
  --force                       忽略本地导入记录，重新生成
  --web                         使用 Zotero Web API，而不是本地 API
`);
}

async function buildConfig(args) {
  const env = await loadDotEnv();
  const mode = pick(args.web ? "web" : "", args.local ? "local" : "", env.ZOTERO_MODE, "local");
  const isWeb = mode === "web";

  return {
    mode,
    baseUrl: isWeb
      ? pick(args.baseUrl, env.ZOTERO_WEB_BASE_URL, "https://api.zotero.org")
      : pick(args.baseUrl, env.ZOTERO_LOCAL_BASE_URL, "http://127.0.0.1:23119/api"),
    userId: pick(args.userId, env.ZOTERO_USER_ID, isWeb ? "" : "0"),
    groupId: pick(args.groupId, env.ZOTERO_GROUP_ID, ""),
    apiKey: pick(args.apiKey, env.ZOTERO_API_KEY, ""),
    collectionKey: pick(args.collection, args.collectionKey, env.ZOTERO_COLLECTION_KEY, ""),
    collectionName: pick(args.collectionName, env.ZOTERO_COLLECTION_NAME, ""),
    limit: Number(pick(args.limit, env.ZOTERO_IMPORT_LIMIT, "20")),
    pollSeconds: Number(pick(args.interval, env.ZOTERO_POLL_SECONDS, "60")),
    dateSource: pick(args.dateSource, env.ZOTERO_DATE_SOURCE, "dateAdded"),
    publish: bool(args.publish),
    dryRun: bool(args.dryRun),
    force: bool(args.force),
    watch: bool(args.watch),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    showHelp();
    return;
  }

  const config = await buildConfig(args);
  if (config.mode === "web" && !config.apiKey) {
    throw new Error("使用 Web API 时需要在 .env 设置 ZOTERO_API_KEY。");
  }
  if (config.mode === "web" && !config.userId && !config.groupId) {
    throw new Error("使用 Web API 时需要在 .env 设置 ZOTERO_USER_ID 或 ZOTERO_GROUP_ID。");
  }

  if (!config.watch) {
    await importOnce(config);
    return;
  }

  console.log(`开始监听 Zotero，每 ${config.pollSeconds} 秒检查一次。按 Ctrl+C 停止。`);
  while (true) {
    try {
      await importOnce(config);
    } catch (error) {
      console.error(`同步失败：${error.message}`);
    }
    await sleep(config.pollSeconds * 1000);
  }
}

main().catch((error) => {
  console.error(error.message);
  if (String(error.message).includes("403")) {
    console.error("如果你使用本地 API，请在 Zotero 设置 -> 高级 中启用本机应用通信。");
  }
  process.exitCode = 1;
});
