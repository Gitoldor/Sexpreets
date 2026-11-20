(() => {
  const FAM_BASE = "https://famgateway.in";
  const GH_API = "https://api.github.com";
  const OWNER = "Gitoldor";
  const REPO = "SAWANTWADI-by-THE12";
  const WORKFLOW = "publish-paid-post.yml";
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
  let publishing = false;

  const showMessage = text => { panel.hidden = false; message.textContent = text; };
  const showError = error => showMessage(error?.message || "Something went wrong. Please try again.");
  const makeCode = () => "SHO-" + crypto.randomUUID().replace(/-/g,"").slice(0,10).toUpperCase();

  function readPost() {
    const post = Object.fromEntries(new FormData(form).entries());
    post.lat = Number(post.lat);
    post.lng = Number(post.lng);
    if (!Number.isFinite(post.lat) || post.lat < -90 || post.lat > 90 || !Number.isFinite(post.lng) || post.lng < -180 || post.lng > 180) {
      throw new Error("Please enter valid map coordinates.");
    }
    return post;
  }

  async function createOrder(apiKey) {
    const url = new URL(FAM_BASE + "/api/qr.php");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("amount", "10");
    url.searchParams.set("customer_name", "Sho1re1 post");
    const response = await fetch(url.toString(), { method: "GET", headers: { "Accept": "application/json" } });
    const result = await response.json();
    if (!response.ok || result.status !== "success" || !result.data?.order_id) {
      throw new Error(result.message || "FamGateway could not create the payment order.");
    }
    return result.data;
  }

  async function checkPayment(orderId) {
    const url = FAM_BASE + "/api/checkout-status.php?order_id=" + encodeURIComponent(orderId);
    const response = await fetch(url, { headers: { "Accept": "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error("FamGateway status check failed (" + response.status + ").");
    return response.json();
  }

  async function dispatchPost(post, order, payment, postCode, githubToken) {
    const url = GH_API + "/repos/" + OWNER + "/" + REPO + "/actions/workflows/" + WORKFLOW + "/dispatches";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": "Bearer " + githubToken,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          post_json: JSON.stringify(post),
          order_id: order.order_id,
          utr: String(payment.utr),
          amount: String(payment.amount ?? order.payable_amount ?? order.amount ?? 10),
          post_code: postCode
        }
      })
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error("GitHub rejected publishing (" + response.status + "). Check that your token can run Actions. " + detail.slice(0,180));
    }
  }

  function beginPolling() {
    clearInterval(pollTimer);
    const started = Date.now();
    pollTimer = setInterval(async () => {
      if (publishing || !active) return;
      try {
        const result = await checkPayment(active.order.order_id);
        if (String(result.status || "").toLowerCase() === "success") {
          const utr = result.utr || result.transaction_id;
          if (!utr) throw new Error("FamGateway reported success but returned no UTR. Please contact support before retrying.");
          const paidAmount = Number(result.amount ?? active.order.payable_amount ?? active.order.amount ?? 10);
          if (paidAmount !== 10) throw new Error("The confirmed payment amount is not ₹10. Publishing stopped.");
          publishing = true;
          clearInterval(pollTimer);
          showMessage("Payment confirmed by FamGateway. Sending your post to Sho1re1…");
          try {
            await dispatchPost(active.post, active.order, { ...result, utr, amount: paidAmount }, active.postCode, active.githubToken);
            publishStatus.textContent = "GitHub accepted the publish workflow. Post code: " + active.postCode;
            message.textContent = "Payment confirmed. Sho1re1 is updating its post database now.";
            localStorage.removeItem("sho1re1_pending_order");
          } catch (error) {
            publishing = false;
            showError(error);
            publishStatus.textContent = "Payment is confirmed, but GitHub publishing needs a retry. Order: " + active.order.order_id + " · UTR: " + utr;
          }
          return;
        }
        if (String(result.status || "").toLowerCase() === "expired") {
          clearInterval(pollTimer);
          showMessage("This payment order expired. Create a fresh order to try again.");
          return;
        }
        message.textContent = "Waiting for FamGateway payment confirmation…";
      } catch (error) {
        message.textContent = error.message + " If this is a CORS error, FamGateway must allow browser requests from this site.";
      }
      if (Date.now() - started > 5 * 60 * 1000) {
        clearInterval(pollTimer);
        message.textContent = "Payment is still pending. You can refresh and check the same order again.";
      }
    }, 4000);
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const apiKey = document.getElementById("fam-key").value.trim();
    const githubToken = document.getElementById("github-token").value.trim();
    if (!apiKey || !githubToken) { showMessage("Enter both connection keys in the testing section first."); return; }
    submit.disabled = true;
    submit.textContent = "Creating ₹10 order…";
    try {
      const post = readPost();
      const order = await createOrder(apiKey);
      active = { post, order, postCode: makeCode(), githubToken };
      code.textContent = active.postCode;
      localStorage.setItem("sho1re1_pending_order", order.order_id);
      checkout.href = order.checkout_url || ("https://famgateway.in/pay.php?order_id=" + encodeURIComponent(order.order_id));
      checkout.hidden = false;
      qr.src = order.qr_url || (FAM_BASE + "/api/qr-image.php?order_id=" + encodeURIComponent(order.order_id));
      qr.hidden = false;
      panel.hidden = false;
      message.textContent = "Order created for ₹10. Complete payment using the QR or checkout link. We’ll check it every 4 seconds.";
      publishStatus.textContent = "FamGateway order: " + order.order_id;
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
})();