const modules = import.meta.glob("./reading/*.md", { eager: true });

const articles = Object.values(modules)
  .map((post) => ({
    ...post.frontmatter,
    url: post.url,
    tags: post.frontmatter.tags ?? [],
  }))
  .filter((post) => !post.draft)
  .sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf());

const escapeXml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export function GET(context) {
  const site = context.site ?? new URL("http://localhost:4321");
  const items = articles
    .map((post) => {
      const url = new URL(post.url, site).toString();
      return `
        <item>
          <title>${escapeXml(post.title)}</title>
          <link>${escapeXml(url)}</link>
          <guid>${escapeXml(url)}</guid>
          <pubDate>${new Date(post.date).toUTCString()}</pubDate>
          <description>${escapeXml(post.description)}</description>
        </item>`;
    })
    .join("");

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>每日阅读札记</title>
        <description>每日阅读文章、摘录和思考。</description>
        <link>${escapeXml(new URL(context.url.pathname.replace(/feed\.xml$/, ""), site).toString())}</link>
        ${items}
      </channel>
    </rss>`, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
