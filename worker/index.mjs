const PRICE_INR = 10;
const ALLOWED_PLANS = new Set(["FREE", "PRO", "PREMIUM"]);
const ALLOWED_LIFETIMES = new Set(["7D", "14D", "30D"]);
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
}
function clean(value, max = 180) { return String(value ?? "").trim().slice(0, max); }
export function validatePost(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Post data is required.");
  const title = clean(input.title, 100), topic = clean(input.topic, 60), type = clean(input.type, 60), subtype = clean(input.subtype, 60);
  const lat = Number(input.lat), lng = Number(input.lng), plan = clean(input.plan || "FREE", 12).toUpperCase(), plan2 = clean(input.plan2 || "7D", 8).toUpperCase();
  const image = clean(input.image, 500), link = clean(input.link, 500);
  if (!title || !topic || !type || !subtype) throw new Error("Title, topic, type and subtype are required.");
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error("Enter valid latitude and longitude.");
  if (!ALLOWED_PLANS.has(plan)) throw new Error("Invalid post plan.");
  if (!ALLOWED_LIFETIMES.has(plan2)) throw new Error("Invalid post lifetime.");
  if (image && !/^https:\/\//i.test(image)) throw new Error("Image URL must start with https://");
  if (link && !/^https:\/\//i.test(link)) throw new Error("Post link must start with https://");
  return { title, topic, type, subtype, plan, plan2, lat, lng, image, link };
}
export function makePendingRecord(post, orderId, postCode, now = new Date().toISOString()) {
  return { orderId, postCode, amount: PRICE_INR, post: validatePost(post), status: "pending", createdAt: now, published: false };
}
async function verifyFamGateway(env, orderId) {
  const url = new URL("https://famgateway.in/api/verify-order.php");
  url.searchParams.set("api_key", env.FAMGATEWAY_API_KEY);
  url.searchParams.set("order_id", orderId);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("FamGateway verification request failed.");
  const data = await response.json();
  return data.data || data;
}
async function publishToSho1re1(env, record) {
  if (record.published) return record;
  if (env.TEST_MODE === "true" && env.TEST_PUBLISH !== "true") {
    record.status = "paid_test"; record.published = false;
    record.note = "Test payment simulated; publishing disabled until TEST_PUBLISH=true.";
    await env.PENDING_POSTS.put(record.orderId, JSON.stringify(record));
    return record;
  }
  if (!env.GITHUB_TOKEN) throw new Error("GitHub publishing secret is not configured.");
  const payload = { event_type: "sho1re1_paid_post", client_payload: {
    post: record.post,
    payment: { status: "success", amount: Number(record.verifiedAmount), orderId: record.orderId, utr: record.utr || "TEST-UTR", postCode: record.postCode, createdAt: record.createdAt }
  }};
  const response = await fetch("https://api.github.com/repos/Gitoldor/SAWANTWADI-by-THE12/dispatches", {
    method: "POST",
    headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: "application/vnd.github+json", "content-type": "application/json", "x-github-api-version": "2022-11-28", "user-agent": "Sho1re1-Post-Publisher" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Sho1re1 publish dispatch failed: " + response.status);
  record.status = "published"; record.published = true; record.publishedAt = new Date().toISOString();
  await env.PENDING_POSTS.put(record.orderId, JSON.stringify(record));
  return record;
}
async function settleIfPaid(env, record) {
  if (record.published || record.status === "paid_test") return record;
  if (env.TEST_MODE === "true") return record;
  const verified = await verifyFamGateway(env, record.orderId);
  const status = String(verified.status || "").toLowerCase();
  if (status !== "success") {
    record.status = status === "expired" ? "expired" : "pending";
    await env.PENDING_POSTS.put(record.orderId, JSON.stringify(record));
    return record;
  }
  const amount = Number(verified.amount ?? verified.payable_amount);
  if (amount !== PRICE_INR) throw new Error("Verified payment amount does not match the post fee.");
  if (!verified.utr) throw new Error("Payment verification did not return a UTR.");
  record.status = "paid"; record.verifiedAmount = amount; record.utr = String(verified.utr);
  await env.PENDING_POSTS.put(record.orderId, JSON.stringify(record));
  return publishToSho1re1(env, record);
}
function cors(request) {
  const origin = request.headers.get("origin") || "";
  const allowed = new Set(["https://gitoldor.github.io", "http://localhost:7700", "http://127.0.0.1:7700"]);
  return { "access-control-allow-origin": allowed.has(origin) ? origin : "https://gitoldor.github.io", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type", vary: "Origin" };
}
export default {
  async fetch(request, env) {
    const headers = cors(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/create-order" && request.method === "POST") {
        const body = await request.json(), post = validatePost(body.post);
        const postCode = "SHO-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
        const testMode = env.TEST_MODE === "true";
        let orderId, checkoutUrl = "", qrUrl = "";
        if (testMode) orderId = "TEST-" + crypto.randomUUID().slice(0, 12).toUpperCase();
        else {
          if (!env.FAMGATEWAY_API_KEY || !env.GITHUB_TOKEN || !env.PENDING_POSTS) return json({ error: "Payment service is not configured." }, 503, headers);
          const response = await fetch("https://famgateway.in/api/create-order", {
            method: "POST",
            headers: { "content-type": "application/json", "x-api-key": env.FAMGATEWAY_API_KEY, accept: "application/json" },
            body: JSON.stringify({ amount: PRICE_INR, customer_name: clean(body.customerName || "Sho1re1 user", 80), redirect_url: "https://gitoldor.github.io/Sexpreets/post.html?payment=return" })
          });
          const result = await response.json();
          if (!response.ok || result.status !== "success" || !result.data?.order_id) return json({ error: result.message || "Could not create payment order." }, 502, headers);
          orderId = result.data.order_id; checkoutUrl = result.data.checkout_url || ""; qrUrl = result.data.qr_url || "";
        }
        if (!env.PENDING_POSTS) return json({ error: "Pending-post storage is not configured." }, 503, headers);
        const record = makePendingRecord(post, orderId, postCode);
        await env.PENDING_POSTS.put(orderId, JSON.stringify(record), { expirationTtl: 86400 });
        return json({ orderId, postCode, amount: PRICE_INR, checkoutUrl, qrUrl, testMode, status: "pending" }, 201, headers);
      }
      if (url.pathname === "/api/status" && request.method === "GET") {
        const orderId = clean(url.searchParams.get("orderId"), 80);
        if (!orderId) return json({ error: "orderId is required." }, 400, headers);
        const raw = await env.PENDING_POSTS.get(orderId);
        if (!raw) return json({ error: "Order not found." }, 404, headers);
        let record = JSON.parse(raw);
        try { record = await settleIfPaid(env, record); }
        catch (error) { record.lastError = error.message; await env.PENDING_POSTS.put(orderId, JSON.stringify(record)); }
        return json({ orderId, postCode: record.postCode, status: record.status, published: record.published, note: record.note || "" }, 200, headers);
      }
      if (url.pathname === "/api/test/complete" && request.method === "POST" && env.TEST_MODE === "true") {
        const body = await request.json(), orderId = clean(body.orderId, 80), raw = await env.PENDING_POSTS.get(orderId);
        if (!raw || !orderId.startsWith("TEST-")) return json({ error: "Test order not found." }, 404, headers);
        let record = JSON.parse(raw);
        record.status = "paid"; record.verifiedAmount = PRICE_INR; record.utr = "TEST-" + crypto.randomUUID().slice(0, 12).toUpperCase();
        await env.PENDING_POSTS.put(orderId, JSON.stringify(record));
        record = await publishToSho1re1(env, record);
        return json({ orderId, postCode: record.postCode, status: record.status, published: record.published, note: record.note || "" }, 200, headers);
      }
      return json({ error: "Not found." }, 404, headers);
    } catch (error) { return json({ error: error.message || "Unexpected error." }, 400, headers); }
  }
};
