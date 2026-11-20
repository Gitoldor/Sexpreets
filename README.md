# Sexpreets is great— automatic page generator

A zero-dependency static website that creates one webpage for every entry in `data/entries.json`.

## How it works

1. Edit `data/entries.json` and add an entry.
2. Commit and push the change to `main`.
3. GitHub Actions runs `scripts/generate-pages.js`.
4. It creates a standalone HTML page at `pages/<slug>.html`, updates the homepage, and deploys the site to GitHub Pages.

You can also run the workflow manually from **Actions → Generate pages and deploy → Run workflow**.

## Add a page

Add an object to `data/entries.json`:

```json
{
  "title": "My new page",
  "slug": "my-new-page",
  "description": "A short summary shown on the homepage and search engines.",
  "content": "The full page content. You can use plain text and line breaks.",
  "createdAt": "2026-11-18"
}
```

Required: `title` and `content`. The slug is optional; if omitted, it is generated from the title. Slugs must be unique.

Content is rendered as escaped plain text (not raw HTML), so entries cannot inject scripts into generated pages.

## Enable GitHub Pages once

In the repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. Save.

The workflow needs repository Actions permission to write generated files:
**Settings → Actions → General → Workflow permissions → Read and write permissions**.

The workflow also declares `contents: write` and the required Pages deployment permissions.

## Run locally (optional)

Requires Node.js 20 or newer:

```bash
node scripts/generate-pages.js
```

Generated pages are written to `pages/` and the deployable website to `dist/`. No npm install is needed.
