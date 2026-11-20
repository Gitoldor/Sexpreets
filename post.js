(() => {
  // Replace this once the Cloudflare Worker has been deployed.
  const API_BASE = "https://sho1re1-post-api.YOUR-SUBDOMAIN.workers.dev";
  const form = document.getElementById("post-form");
  const submit = document.getElementById("submit-button");
  const panel = document.getElementById("payment-panel");
  const code = document.getElementById("post-code");
  const message = document.getElementById("payment-message");
  const checkout = document.getElementById("checkout-button");
  const qr = document.getElementById("qr-image");
  const testPay = document.getElementById("test-pay-button");
  const publishStatus = document.getElementById("publish-status");
  let activeOrder = null;
  let pollTimer = null;

  function showError(error) { message.textContent = error.message || "Something went wrong. Please try again."; panel.hidden = false; }
  function api(path, options = {}) {
    return fetch(API_BASE + path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } })
      .then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Request failed."); return data; });
  }
  function getPost() {
    const data = Object.fromEntries(new FormData(form).entries());
    data.lat = Number(data.lat); data.lng = Number(data.lng);
    return data;
  }
  function startPolling(orderId) {
    clearInterval(pollTimer);
    const started = Date.now();
    pollTimer = setInterval(async () => {
      try {
        const status = await api("/api/status?orderId=" + encodeURIComponent(orderId));
        if (status.status === "published" && status.published) {
          clearInterval(pollTimer);
          message.textContent = "Payment confirmed. Your post has been sent to Sho1re1 and will appear after GitHub publishes the update.";
          publishStatus.textContent = "Published successfully · " + status.postCode;
          return;
        }
        if (status.status === "paid_test") {
          clearInterval(pollTimer);
          message.textContent = status.note || "Test payment confirmed.";
          publishStatus.textContent = "Test passed. No live post was added.";
          return;
        }
        if (status.status === "expired") {
          clearInterval(pollTimer);
          message.textContent = "This payment session expired. Please create a new post order.";
          return;
        }
        message.textContent = "Waiting for payment confirmation…";
      } catch (error) { message.textContent = error.message; }
      if (Date.now() - started > 5 * 60 * 1000) {
        clearInterval(pollTimer);
        message.textContent = "Still waiting. You can refresh this page and check again using your post code.";
      }
    }, 4000);
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    submit.disabled = true;
    submit.textContent = "Generating your post code…";
    panel.hidden = false;
    message.textContent = "Creating your ₹10 payment order…";
    try {
      const order = await api("/api/create-order", { method: "POST", body: JSON.stringify({ post: getPost() }) });
      activeOrder = order;
      localStorage.setItem("sho1re1_pending_order", order.orderId);
      code.textContent = order.postCode;
      checkout.hidden = !order.checkoutUrl;
      if (order.checkoutUrl) checkout.href = order.checkoutUrl;
      qr.hidden = !order.qrUrl;
      if (order.qrUrl) qr.src = order.qrUrl;
      testPay.hidden = !order.testMode;
      message.textContent = order.testMode ? "Test order created. Simulate the payment to test the flow." : "Your post code is ready. Complete payment to publish.";
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      if (!order.testMode) startPolling(order.orderId);
    } catch (error) { showError(error); }
    finally { submit.disabled = false; submit.innerHTML = 'Generate post code <span>↗</span>'; }
  });

  testPay.addEventListener("click", async () => {
    if (!activeOrder) return;
    testPay.disabled = true;
    testPay.textContent = "Simulating payment…";
    try {
      const result = await api("/api/test/complete", { method: "POST", body: JSON.stringify({ orderId: activeOrder.orderId }) });
      message.textContent = result.note || "Test payment confirmed.";
      publishStatus.textContent = result.published ? "Test post dispatched to Sho1re1." : "Payment flow passed; live publishing is disabled in test mode.";
    } catch (error) { showError(error); }
    finally { testPay.disabled = false; testPay.textContent = "Simulate ₹10 test payment"; }
  });

  document.getElementById("copy-code").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(code.textContent); document.getElementById("copy-code").textContent = "Copied"; }
    catch (_) { message.textContent = "Select and copy the post code manually."; }
  });

  document.getElementById("locate").addEventListener("click", () => {
    if (!navigator.geolocation) { message.textContent = "Location is not supported by this browser."; panel.hidden = false; return; }
    const button = document.getElementById("locate"); button.disabled = true; button.textContent = "Finding location…";
    navigator.geolocation.getCurrentPosition(position => {
      form.elements.lat.value = position.coords.latitude.toFixed(6);
      form.elements.lng.value = position.coords.longitude.toFixed(6);
      button.disabled = false; button.textContent = "Location added";
    }, error => { button.disabled = false; button.textContent = "Use my current location"; message.textContent = error.message; panel.hidden = false; }, { enableHighAccuracy: true, timeout: 12000 });
  });

  const returnedOrder = new URLSearchParams(location.search).get("order");
  const savedOrder = returnedOrder || localStorage.getItem("sho1re1_pending_order");
  if (savedOrder && new URLSearchParams(location.search).has("payment")) {
    panel.hidden = false;
    message.textContent = "Checking your payment…";
    api("/api/status?orderId=" + encodeURIComponent(savedOrder)).then(status => {
      code.textContent = status.postCode || "Post code unavailable";
      if (status.published) message.textContent = "Payment verified and post published.";
      else startPolling(savedOrder);
    }).catch(showError);
  }
})();