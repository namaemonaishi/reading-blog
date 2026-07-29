import { defineConfig } from "astro/config";

const owner = process.env.GITHUB_REPOSITORY_OWNER;
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true" && owner && repo;
const isUserSite = isGitHubPagesBuild && repo === `${owner}.github.io`;

export default defineConfig({
  site: isGitHubPagesBuild ? `https://${owner}.github.io` : "http://localhost:4321",
  base: isGitHubPagesBuild && !isUserSite ? `/${repo}` : "/",
});
