# 每日阅读札记

这是一个为每日阅读记录准备的 Astro 静态博客，适合部署到 GitHub Pages。

## 为什么选 Astro

Astro 对 Markdown 文章很友好，构建结果是静态 HTML，部署到 GitHub Pages 很轻。你每天新增一篇 `.md` 文件，首页、归档、标签页和 RSS 会自动更新。

## 每天怎么用

1. 进入 `E:\blog\src\pages\reading`。
2. 复制示例文章，改名为 `YYYY-MM-DD-英文或拼音标题.md`，比如 `2026-07-30-ai-notes.md`。
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
