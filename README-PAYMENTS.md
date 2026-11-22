# Sho1re1 posting with Cloudflare D1

The posting form stays on GitHub Pages. Post details remain in the browser until FamGateway confirms the payment. The Worker does not create a post or pending-order row in D1 before payment.

## Verified-payment flow

1. Fill in the post details. They remain in the browser form.
2. Tap **Create ₹1 payment**. The Worker asks FamGateway to create a checkout link; no post/order record is written to D1.
3. Open the UPI app and complete payment.
4. The page automatically polls the Worker. The Worker checks the order directly with FamGateway using the server-to-server `GET /api/verify-order.php` endpoint.
5. When FamGateway reports `success`, the browser sends the post to `POST /api/posts`.
6. Before writing, the Worker independently verifies the same order again, checks the exact ₹1 amount and 12-digit UTR, and inserts the post as `published`.
7. A unique D1 index on UTR prevents the same payment from being reused. The homepage reads published posts from `GET /api/posts`.

## Security behavior

- No D1 post/order row is created when the checkout is created or while payment is pending.
- The browser cannot publish by asserting that payment happened. The Worker re-verifies directly with FamGateway before every insert.
- The gateway order ID, verified amount, and UTR must match.
- Replayed UTRs are rejected by a unique database index.
- There is no manual “I've paid” publish button.
- A user can still create a payment session and abandon it; that session remains only at FamGateway and expires there.

## Cloudflare resources

- D1 database: sexpreets-posts
- Worker: sexpreets-post-api
- D1 binding: DB
- API: https://sexpreets-post-api.sho1re1.workers.dev

## FamGateway key

The rotated FamGateway key is entered through `settings.html`, kept in the current browser tab's session storage, and sent over HTTPS to the Worker. The Worker uses it for server-to-server order creation and verification. It is not committed to GitHub. For a fully managed deployment, configure `FAMGATEWAY_API_KEY` as a Worker secret and remove the browser key setup. Rotate any key previously exposed in public code/history.

## Routes

- `GET /api/health`
- `GET /api/posts`
- `POST /api/orders` — creates checkout only; no D1 write
- `GET /api/verify-order?order_id=...` — asks FamGateway for authoritative status
- `POST /api/posts` — re-verifies payment and inserts only after success
