import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

function splitInlineMath(node) {
  const parts = [];
  const regex = /\\\((.+?)\\\)/gs;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(node.value))) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: node.value.slice(lastIndex, match.index) });
    }
    parts.push({ type: "inlineMath", value: match[1].trim() });
    lastIndex = regex.lastIndex;
  }

  if (parts.length === 0) return node;
  if (lastIndex < node.value.length) {
    parts.push({ type: "text", value: node.value.slice(lastIndex) });
  }
  return parts;
}

function remarkLatexDelimiters() {
  return (tree) => {
    const transform = (node) => {
      if (!node || typeof node !== "object") return node;

      if (
        node.type === "paragraph" &&
        node.children?.length === 1 &&
        node.children[0].type === "text"
      ) {
        const value = node.children[0].value.trim();
        const displayMatch = value.match(/^\\\[((?:.|\n)*)\\\]$/);
        if (displayMatch) {
          return { type: "math", value: displayMatch[1].trim() };
        }
      }

      if (node.type === "text" && typeof node.value === "string") {
        return splitInlineMath(node);
      }

      if (Array.isArray(node.children)) {
        node.children = node.children.flatMap((child) => transform(child));
      }

      return node;
    };

    transform(tree);
  };
}

const owner = process.env.GITHUB_REPOSITORY_OWNER;
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true" && owner && repo;
const isUserSite = isGitHubPagesBuild && repo === `${owner}.github.io`;

export default defineConfig({
  site: isGitHubPagesBuild ? `https://${owner}.github.io` : "http://localhost:4321",
  base: isGitHubPagesBuild && !isUserSite ? `/${repo}` : "/",
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath, remarkLatexDelimiters],
      rehypePlugins: [rehypeKatex],
    }),
  },
});
