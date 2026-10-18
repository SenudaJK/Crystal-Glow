(function () {
  if (window.location.hostname.endsWith("github.io")) return;
  const api = (url, options) => fetch(url, { headers: { "Content-Type": "application/json" }, ...options }).then(async response => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Something went wrong. Please try again.");
    return body;
  });
  const replaceHandler = (selector, eventType, handler) => {
    const element = document.querySelector(selector);
    if (!element) return;
    const replacement = element.cloneNode(true);
    element.replaceWith(replacement);
    replacement.addEventListener(eventType, handler);
  };
  const replaceElement = selector => {
    const element = document.querySelector(selector);
    if (!element) return;
    const replacement = element.cloneNode(true);
    element.replaceWith(replacement);
  };
  let signedInCustomer = null;
  const initialsFor = name => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const escapeAttribute = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const showAccountMenu = customer => {
    openModal(`<p class="dialog-eyebrow">Your glow account</p><h3 id="modal-title">Hello, ${customer.name.split(/\s+/)[0]}.</h3><div class="account-summary"><span class="account-summary-avatar">${initialsFor(customer.name)}</span><div><b>${customer.name}</b><small>${customer.email}</small></div></div><p>Your account is signed in and ready for future order history and saved details.</p><button class="button button-outline" id="logout-button">Sign out <span>→</span></button>`);
    document.querySelector("#logout-button").addEventListener("click", async event => {
      event.currentTarget.disabled = true;
      try {
        await api("/api/auth/logout", { method: "POST" });
        closeModal();
        updateAccountButton(null);
        toast("You’ve been signed out.");
      } catch (error) {
        event.currentTarget.disabled = false;
        toast(error.message);
      }
    });
  };
  const updateAccountButton = customer => {
    const button = document.querySelector("#account-trigger");
    if (!button) return;
    button.innerHTML = customer
      ? `<span class="account-initials">${initialsFor(customer.name)}</span>`
      : '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c.7-3.2 3.5-5.3 7.2-5.3s6.5 2.1 7.2 5.3"/></svg>';
    button.setAttribute("aria-label", customer ? `Account for ${customer.name}` : "Sign in to your account");
    button.onclick = () => customer ? showAccountMenu(customer) : (window.location.href = "/login");
  };
  const checkout = () => {
    const items = JSON.parse(localStorage.getItem("cg-cart") || "[]");
    const name = signedInCustomer ? signedInCustomer.name : "";
    const email = signedInCustomer ? signedInCustomer.email : "";
    openModal(`<p class="dialog-eyebrow">Secure order details</p><h3 id="modal-title">Where should we deliver?</h3><form id="checkout-form"><fieldset><legend>Contact details</legend><label>Name<input name="name" value="${escapeAttribute(name)}" required minlength="2" autocomplete="name" ${signedInCustomer ? "readonly" : ""}></label><label>Email<input name="email" type="email" value="${escapeAttribute(email)}" required autocomplete="email" ${signedInCustomer ? "readonly" : ""}></label><label>Phone<input name="phone" required minlength="7" autocomplete="tel"></label></fieldset><fieldset><legend>Shipping address</legend><label>Address<textarea name="shippingAddress" required minlength="5" autocomplete="shipping street-address"></textarea></label><label>City<input name="shippingCity" required minlength="2" autocomplete="shipping address-level2"></label><label>Postal code<input name="shippingPostalCode" required minlength="3" autocomplete="shipping postal-code"></label></fieldset><fieldset><legend>Billing address</legend><label class="checkbox-row"><input id="billing-same" name="billingSame" type="checkbox" checked> Billing address is the same as shipping</label><div id="billing-fields" hidden><label>Address<textarea name="billingAddress" minlength="5" autocomplete="billing street-address"></textarea></label><label>City<input name="billingCity" minlength="2" autocomplete="billing address-level2"></label><label>Postal code<input name="billingPostalCode" minlength="3" autocomplete="billing postal-code"></label></div></fieldset><p class="routine-result">Payment method: Cash on delivery. Delivery is free over Rs. 5,000; otherwise Rs. 350.</p><button class="button button-dark" type="submit">Place order <span>→</span></button></form>`);
    const sameBilling = document.querySelector("#billing-same");
    const billingFields = document.querySelector("#billing-fields");
    sameBilling.onchange = () => { billingFields.hidden = sameBilling.checked; billingFields.querySelectorAll("input, textarea").forEach(field => { field.required = !sameBilling.checked; }); };
    document.querySelector("#checkout-form").addEventListener("submit", async event => {
      event.preventDefault();
      const button = event.target.querySelector("button");
      button.disabled = true;
      try {
        const data = Object.fromEntries(new FormData(event.target));
        if (data.billingSame) {
          data.billingAddress = data.shippingAddress;
          data.billingCity = data.shippingCity;
          data.billingPostalCode = data.shippingPostalCode;
        }
        const order = await api("/api/orders", {
          method: "POST",
          body: JSON.stringify({
            customer: data,
            items: items.map(item => ({ productId: item.id, quantity: item.qty }))
          })
        });
        localStorage.setItem("cg-cart", "[]");
        closeModal();
        toast(`Order ${order.orderId} confirmed. Pay on delivery.`);
        location.reload();
      } catch (error) {
        button.disabled = false;
        toast(error.message);
      }
    });
  };
  replaceHandler("#checkout-button", "click", checkout);
  replaceHandler("#newsletter-form", "submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api("/api/newsletter", { method: "POST", body: JSON.stringify({ email: form.querySelector("input").value }) });
      form.reset();
      toast("You’re on the glow list.");
    } catch (error) {
      toast(error.message);
    }
  });
  replaceElement("#account-trigger");
  api("/api/auth/me").then(({ customer }) => { signedInCustomer = customer; updateAccountButton(customer); }).catch(() => updateAccountButton(null));
  const trustItems = document.querySelectorAll(".trust-strip span");
  if (trustItems.length) trustItems[trustItems.length - 1].textContent = "Cash on delivery checkout";
  const footerNote = document.querySelector(".footer-contact");
  if (footerNote) {
    footerNote.querySelector("b").textContent = "Crystal Glow support";
    footerNote.querySelector("p").textContent = "Guest checkout and cash on delivery are available. Store policies and support details should be finalized before launch.";
  }
  api("/api/products").then(serverProducts => {
    const byId = new Map(serverProducts.map(product => [product.id, product]));
    products.forEach(product => {
      const serverProduct = byId.get(product.id);
      if (serverProduct) {
        product.price = serverProduct.price;
        product.stock = serverProduct.stock;
      }
    });
    renderProducts();
    renderCart();
  }).catch(error => toast(error.message));
})();
