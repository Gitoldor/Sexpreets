(() => {
  const API = "https://sexpreets-post-api.sho1re1.workers.dev";
  const form = document.getElementById("post-form");
  const submit = document.getElementById("submit-button");
  const panel = document.getElementById("payment-panel");
  const code = document.getElementById("post-code");
  const message = document.getElementById("payment-message");
  const checkout = document.getElementById("checkout-button");
  const qr = document.getElementById("qr-image");
  const publishStatus = document.getElementById("publish-status");
  let active = null;
  let pollTimer = null;
  let polling = false;

  const showMessage = text => { panel.hidden = false; message.textContent = text; };
  const showError = error => showMessage(error?.message || "Something went wrong. Please try again.");
  const makeCode = () => "SHO-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();

  function readPost() {
    const post = Object.fromEntries(new FormData(form).entries());
    post.lat = Number(post.lat);
    post.lng = Number(post.lng);
    if (!Number.isFinite(post.lat) || post.lat < -90 || post.lat > 90 || !Number.isFinite(post.lng) || post.lng < -180 || post.lng > 180) {
      throw new Error("Please enter valid map coordinates.");
    }
    return post;
  }

  async function api(path, options = {}) {
    const response = await fetch(API + path, {
      ...options,
      headers: { "Accept": "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(sessionStorage.getItem("famgateway_api_key") ? { "X-FamGateway-Api-Key": sessionStorage.getItem("famgateway_api_key") } : {}), ...(options.headers || {}) },
      cache: "no-store"
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) throw new Error(result.error || result.message || "Cloudflare API error (" + response.status + ").");
    return result;
  }

  async function createOrder(post, postCode) {
    return api("/api/orders", { method: "POST", body: JSON.stringify({ post, post_code: postCode }) });
  }

  async function checkPayment() {
    return api("/api/orders/" + encodeURIComponent(active.order.order_id) + "/status");
  }

  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
    polling = false;
  }

  function beginPolling() {
    stopPolling();
    const started = Date.now();
    pollTimer = setInterval(async () => {
      if (polling || !active) return;
      polling = true;
      try {
        const result = await checkPayment();
        if (result.status === "success" && result.published) {
          stopPolling();
          localStorage.removeItem("sho1re1_pending_order");
          message.textContent = "Payment confirmed. Your post is published to the Sho1re1 database.";
          publishStatus.textContent = "Published successfully · " + (result.post_code || active.postCode);
          checkout.hidden = true;
          return;
        }
        if (result.status === "expired") {
          stopPolling();
          showMessage("This payment order expired. Create a fresh order to try again.");
          return;
        }
        message.textContent = "Waiting for FamGateway payment confirmation…";
      } catch (error) {
        message.textContent = error.message;
      } finally {
        polling = false;
      }
      if (Date.now() - started > 5 * 60 * 1000) {
        stopPolling();
        message.textContent = "Payment is still pending. Your order is saved. Refresh and check it again.";
      }
    }, 4000);
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    submit.disabled = true;
    submit.textContent = "Creating ₹1 order…";
    try {
      const post = readPost();
      const postCode = makeCode();
      const order = await createOrder(post, postCode);
      active = { order, postCode };
      code.textContent = postCode;
      localStorage.setItem("sho1re1_pending_order", JSON.stringify({ order_id: order.order_id, postCode }));
      checkout.href = order.upi_intent;
      checkout.target = "_self";
      checkout.innerHTML = 'Pay ₹1 with UPI <span>↗</span>';
      checkout.hidden = false;
      qr.hidden = true;
      panel.hidden = false;
      message.textContent = "Order created for ₹1. Tap “Pay ₹1 with UPI”, complete payment, then return here. Cloudflare checks the payment and publishes automatically.";
      publishStatus.textContent = "Cloudflare order: " + order.order_id;
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      beginPolling();
    } catch (error) {
      showError(error);
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Generate post code <span>↗</span>';
    }
  });

  document.getElementById("copy-code").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code.textContent);
      document.getElementById("copy-code").textContent = "Copied";
    } catch (_) { showMessage("Select and copy the post code manually."); }
  });

  document.getElementById("locate").addEventListener("click", () => {
    const button = document.getElementById("locate");
    if (!navigator.geolocation) { showMessage("Location is not supported by this browser."); return; }
    button.disabled = true;
    button.textContent = "Finding location…";
    navigator.geolocation.getCurrentPosition(position => {
      form.elements.lat.value = position.coords.latitude.toFixed(6);
      form.elements.lng.value = position.coords.longitude.toFixed(6);
      button.disabled = false;
      button.textContent = "Location added";
    }, error => {
      button.disabled = false;
      button.textContent = "Use my current location";
      showMessage(error.message);
    }, { enableHighAccuracy: true, timeout: 12000 });
  });

  try {
    const saved = JSON.parse(localStorage.getItem("sho1re1_pending_order") || "null");
    if (saved?.order_id) {
      active = { order: { order_id: saved.order_id }, postCode: saved.postCode || "" };
      code.textContent = active.postCode || "Saved order";
      panel.hidden = false;
      message.textContent = "Resuming payment verification for your saved order…";
      beginPolling();
    }
  } catch (_) {}
})();