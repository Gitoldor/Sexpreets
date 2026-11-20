const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "entries.json");
const pagesDir = path.join(root, "pages");
const distDir = path.join(root, "dist");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function slugify(value) {
  return String(value).toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 70) || "page";
}
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

const entries = JSON.parse(fs.readFileSync(dataFile, "utf8"));
if (!Array.isArray(entries)) throw new Error("data/entries.json must contain an array.");

const seen = new Set();
const pages = entries.map((entry, index) => {
  if (!entry || typeof entry !== "object" || !String(entry.title || "").trim() || typeof entry.content !== "string") {
    throw new Error("Entry " + (index + 1) + " needs a title and content string.");
  }
  let slug = slugify(entry.slug || entry.title);
  if (seen.has(slug)) throw new Error('Duplicate page slug: "' + slug + '". Slugs must be unique.');
  seen.add(slug);
  return {
    title: String(entry.title).trim(),
    slug,
    description: String(entry.description || "").trim(),
    content: entry.content,
    createdAt: String(entry.createdAt || "").trim()
  };
});

fs.rmSync(pagesDir, { recursive: true, force: true });
fs.rmSync(distDir, { recursive: true, force: true });
ensureDir(pagesDir);
ensureDir(path.join(distDir, "pages"));

const pageIndex = pages.map(({ title, slug, description, createdAt }) => ({
  title, slug, description, createdAt, url: "pages/" + slug + ".html"
}));
fs.writeFileSync(path.join(root, "pages.json"), JSON.stringify(pageIndex, null, 2) + "\n");

for (const page of pages) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escapeHtml(page.description)}"><title>${escapeHtml(page.title)} · Sexpreets</title><link rel="stylesheet" href="../styles.css"></head>
<body><header class="site-header"><a class="brand" href="../">Sexpreets<span>.</span></a><span class="header-note">PAGE</span></header><main class="wrap article"><a class="back" href="../">← All pages</a><h1>${escapeHtml(page.title)}</h1>${page.description ? '<p class="description">' + escapeHtml(page.description) + '</p>' : ''}${page.createdAt ? '<p class="article-date">' + escapeHtml(page.createdAt) + '</p>' : ''}<div class="article-content">${escapeHtml(page.content)}</div></main><footer class="footer">Automatically generated with GitHub Actions.</footer></body></html>`;
  fs.writeFileSync(path.join(pagesDir, page.slug + ".html"), html);
  fs.writeFileSync(path.join(distDir, "pages", page.slug + ".html"), html);
}

for (const file of ["index.html", "styles.css", "app.js", "post.html", "post.css", "post.js"]) {
  fs.copyFileSync(path.join(root, file), path.join(distDir, file));
}
fs.copyFileSync(path.join(root, "pages.json"), path.join(distDir, "pages.json"));
fs.writeFileSync(path.join(distDir, ".nojekyll"), "");
console.log("Generated " + pages.length + " page(s).");
