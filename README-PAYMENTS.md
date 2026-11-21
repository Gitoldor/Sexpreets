# Sexpreets → Sho1re1 Cloudflare publishing

The public post form stays on GitHub Pages, but GitHub is no longer used to publish or store submitted posts.

## Flow
1. The user fills the existing Sho1re1 post fields and gets a unique SHO- code.
2. The browser sends the post data to the Cloudflare Worker.
3. The Worker creates the ₹1 FamGateway order and stores a pending order in Cloudflare D1.
4. The user pays using the returned UPI intent.
5. The browser polls the Worker. The Worker independently checks FamGateway's order status using its server-side secret.
6. Only after FamGateway reports success, a UTR is present, and the amount is exactly ₹1, the Worker marks the order paid and inserts the post and payment into D1.
7. The public posts endpoint reads published posts from D1.

## Cloudflare resources
- D1: `sexpreets-posts`
- Worker: `sexpreets-post-api`
- Binding: `DB`
- Required Worker secret: `FAMGATEWAY_API_KEY`

Set the rotated FamGateway API key as a Worker secret. Do not put it in `post.js`, HTML, or any public repository file. The previously exposed key should be rotated.

## GitHub's remaining role
GitHub Pages still hosts the static form and website files. No GitHub Personal Access Token is used by the post/payment flow. The old GitHub Actions publishing dispatch has been removed from `post.js`.

## API
- `GET /api/health`
- `GET /api/posts`
- `POST /api/orders`
- `GET /api/orders/:id/status`

Fee remains ₹1 for this current test flow. The database schema is in `schema.sql`.
