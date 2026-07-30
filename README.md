# 每日阅读札记

这是一个为每日阅读记录准备的 Astro 静态博客，适合部署到 GitHub Pages。

## 为什么选 Astro

Astro 对 Markdown 文章很友好，构建结果是静态 HTML，部署到 GitHub Pages 很轻。你每天新增一篇 `.md` 文件，首页、归档、标签页和 RSS 会自动更新。

## 每天怎么用

最省事的方式是运行新文章生成器：

```powershell
cd E:\blog
npm run new
```

它会让你选择模板并填写标题、链接、来源、标签等信息，然后自动在 `src\pages\reading` 里创建一篇格式完整的 `.md` 文章。

目前有三种模板：

- `daily`：日常阅读，适合每天读完一篇文章后的标准记录。
- `deep`：深度阅读，适合长文、论文、书评或需要拆论证的文章。
- `digest`：链接速记，适合先保存链接和三点收获。

你也可以直接带参数创建：

```powershell
node scripts/new-reading-note.mjs --template daily --title "文章标题" --url "https://example.com/article" --source "文章来源" --tags "AI,阅读,方法"
```

生成后打开新文件，继续写正文即可。

## 从 Zotero 自动生成草稿

这个项目可以从 Zotero 桌面端自动读取新导入的条目，并在 `src\pages\reading` 里生成一篇已经填好元信息的 Markdown 草稿。

先在 Zotero 里打开本地 API：

1. 打开 Zotero。
2. 进入 `设置` -> `高级`。
3. 勾选 `Allow other applications on this computer to communicate with Zotero`。

然后运行：

```powershell
cd E:\blog
npm run zotero:import
```

它会读取 Zotero 最近新增的条目，生成类似这样的文件：

```text
E:\blog\src\pages\reading\_2026-07-30-article-title.md
```

文件名开头有 `_`，所以不会被发布。你整理完笔记后：

1. 把文件名开头的 `_` 删除，比如改成 `2026-07-30-article-title.md`。
2. 把文件里的 `draft: true` 改成 `draft: false`。
3. 补全正文。
4. 提交并推送。

如果你想让它一直监听 Zotero，每隔一分钟检查一次新条目：

```powershell
cd E:\blog
npm run zotero:watch
```

只同步某个 Zotero collection：

```powershell
node scripts/zotero-to-reading.mjs --collection-name "Reading Blog"
```

默认使用 Zotero 本地 API，不需要 API key。需要改配置时，可以复制 `.env.example` 为 `.env` 后再修改。

## 手动复制模板

1. 进入 `E:\blog\src\pages\reading`。
2. 从 `E:\blog\templates` 里复制一个模板，或者复制示例文章，改名为 `YYYY-MM-DD-英文或拼音标题.md`，比如 `2026-07-30-ai-notes.md`。
3. 修改文件顶部的字段：

```md
---
layout: ../../layouts/ReadingLayout.astro
title: "文章标题"
description: "用一两句话写清楚这篇文章为什么值得保存。"
date: 2026-07-30
source: "文章来源"
sourceUrl: "https://example.com/article"
author: "作者名"
tags: ["AI", "写作", "方法"]
mood: "读完后的短评价"
---
```

4. 在下面写正文，可以用 Markdown 的标题、列表、引用和链接。

## 在 VS Code 里快速展开模板

如果你用 VS Code 打开 `E:\blog`：

1. 在 `src\pages\reading` 里新建一个 `.md` 文件。
2. 输入 `readingnote`，按 `Tab`，会展开日常阅读模板。
3. 输入 `deepreading`，按 `Tab`，会展开深度阅读模板。

这个功能来自项目里的 `.vscode\reading-note.code-snippets`。

## 本地预览

第一次使用：

```powershell
cd E:\blog
npm install
npm run dev
```

之后日常预览：

```powershell
cd E:\blog
npm run dev
```

浏览器打开终端里显示的本地地址，通常是 `http://localhost:4321`。

## 发布到 GitHub Pages 需要你提供

- GitHub 用户名。
- 仓库名。推荐两种：
  - `你的用户名.github.io`：网站地址是 `https://你的用户名.github.io/`。
  - 任意仓库名，比如 `reading-blog`：网站地址是 `https://你的用户名.github.io/reading-blog/`。
- 是否要公开仓库。GitHub 免费用户一般用公开仓库最省事。
- 是否有自定义域名。如果有，需要域名和 DNS 管理权限。

项目里已经放好了 `.github/workflows/deploy.yml`。代码推送到 GitHub 后，在仓库的 Settings -> Pages 里把 Source 设为 GitHub Actions，之后每次推送都会自动发布。
