# Sho1re1 posting with Cloudflare D1

The posting form stays on GitHub Pages. Cloudflare Worker handles FamGateway requests and publishes verified posts into D1.

## Same flow as the earlier GitHub publisher

1. Fill the same post fields: title, topic, type, subtype, latitude, longitude, optional image/link, plan and duration.
2. Generate a unique `SHO-` post code.
3. Cloudflare Worker calls FamGateway to create the ₹1 order and stores the post data with a pending order in D1.
4. The form opens the returned direct `upi://pay` intent.
5. The browser polls the Cloudflare status route every four seconds, matching the old GitHub version's polling interval.
6. Worker checks FamGateway status, requires a successful status and UTR, and verifies the amount is ₹1.
7. Worker writes the payment, published post and final order status to D1 in one batch.
8. The public homepage reads published posts from the D1-backed API.

## Cloudflare resources

- D1 database: `sexpreets-posts`
- Worker: `sexpreets-post-api`
- D1 binding: `DB`
- Public API: `https://sexpreets-post-api.sho1re1.workers.dev`

## FamGateway key

For this test setup, paste the rotated FamGateway key into [Payment settings](settings.html). It is stored in the current browser tab's session storage and sent to the Worker over HTTPS. The Worker also supports a `FAMGATEWAY_API_KEY` secret, which is the recommended production setup. Do not put the real key in public JavaScript or commit it to GitHub. Rotate any key previously exposed in chat or repository history.

## Routes

- `GET /api/health`
- `GET /api/posts`
- `POST /api/orders`
- `GET /api/orders/:id/status`

The current test fee is ₹1. D1 schema: [schema.sql](schema.sql).
