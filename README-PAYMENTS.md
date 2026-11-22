# Sho1re1 posting with Cloudflare D1

The posting form stays on GitHub Pages. The Cloudflare Worker creates a FamGateway checkout link, but it does not create a D1 row at checkout time and does not verify payment.

## Current browser-confirmation flow

1. Fill in the post details. They remain in the browser form.
2. Tap Pay ₹1. The Worker asks FamGateway to create a checkout link; no post/order record is written to D1.
3. Complete payment in the UPI app and return to the page.
4. Tap “I've paid — publish my post”.
5. The browser sends the post to the POST /api/posts endpoint; the Worker writes it directly as published.
6. The homepage reads published posts from GET /api/posts.

## Important limitation

This is a convenience flow, not secure payment verification. The Worker does not independently confirm that the UPI payment succeeded. Anyone can call the public POST /api/posts endpoint without paying. Do not use this design for real paid access or revenue collection. For enforced payment, payment status must be verified by a trusted server-side integration or gateway webhook.

## Cloudflare resources

- D1 database: sexpreets-posts
- Worker: sexpreets-post-api
- D1 binding: DB
- API: https://sexpreets-post-api.sho1re1.workers.dev

## FamGateway key

Store the rotated FamGateway key in settings.html; it is kept in the current browser tab's session storage and sent to the Worker over HTTPS for checkout creation. Do not put the key in public JavaScript or commit it to GitHub. Rotate any key previously exposed in public code/history.

## Routes

- GET /api/health
- GET /api/posts
- POST /api/orders — creates checkout only; no D1 write
- POST /api/posts — writes a post after the browser's “I've paid” confirmation
