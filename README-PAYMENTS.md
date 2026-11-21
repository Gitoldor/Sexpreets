# Sho1re1 browser-only post publishing

The post flow runs from the browser. There is no Cloudflare Worker, server, KV database, or backend registration.

## Flow
1. Open `post.html` on GitHub Pages.
2. Enter the FamGateway API key and a GitHub token in the testing connection section. They are used only in the current page session and are not saved by this page.
3. Fill the Sho1re1 post fields and create a ₹1 FamGateway order.
4. The browser polls FamGateway's public `/api/checkout-status.php` endpoint.
5. On a successful response with a UTR, the browser triggers `publish-paid-post.yml` through GitHub's Actions API.
6. GitHub Actions appends the post to `window.Sho1re1Places` in the Sho1re1 `app.js` database.

## GitHub token
For this test, provide a token that can dispatch Actions in `Gitoldor/SAWANTWADI-by-THE12` (classic token with `repo` scope, or an appropriately scoped fine-grained token with Actions write and repository contents write permissions).

## Browser limitations
FamGateway's public checkout-status endpoint is documented for browser polling. Direct order creation also runs from the browser. The browser must be allowed by FamGateway CORS policy. If the browser reports a CORS/network error, a browser-only integration cannot bypass that restriction.

This is a testing flow: payment confirmation is checked in the browser and the GitHub workflow trusts the values submitted by that browser. It is not suitable as a production payment authorization system.
