# Sho1re1 paid-post flow

The new post form lives at `post.html`. The Worker stores pending post data in KV, creates FamGateway ₹10 orders, verifies payment server-side, and dispatches a publish event to Sho1re1. The main-repository workflow appends the verified record to `window.Sho1re1Places` in `app.js`.

## Tests
Run `node --test tests/*.test.mjs` with Node.js 20+. No npm dependencies required.

## Cloudflare setup
1. Create a Cloudflare KV namespace named `PENDING_POSTS`.
2. Replace the placeholder KV namespace ID in `worker/wrangler.toml`.
3. Deploy from the `worker` directory with Wrangler.
4. Add Worker secrets `FAMGATEWAY_API_KEY` and `GITHUB_TOKEN`. The GitHub token needs permission to dispatch an event to `Gitoldor/SAWANTWADI-by-THE12`.
5. Keep `TEST_MODE=true` for simulated orders. Keep `TEST_PUBLISH=false` to prevent test posts reaching the public map. For an end-to-end test publish, temporarily set `TEST_PUBLISH=true` and submit an obvious test post; delete it afterwards.
6. For live payments, set `TEST_MODE=false` and `TEST_PUBLISH=false`.
7. Replace `API_BASE` in `post.js` with the deployed Worker URL.

Credentials stay in Worker secrets, never in browser JavaScript or committed files.
