(function () {
  const form = document.querySelector("#login-form");
  const message = document.querySelector("#auth-message");
  const setMessage = text => { message.textContent = text; };
  const api = (url, options) => fetch(url, { headers: { "Content-Type": "application/json" }, ...options }).then(async response => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Something went wrong. Please try again.");
    return body;
  });
  let mode = "login";
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    setMessage("");
    try {
      const data = Object.fromEntries(new FormData(form));
      if (mode === "register") {
        await api("/api/auth/register", { method: "POST", body: JSON.stringify(data) });
        mode = "login";
        window.location.href = "/login";
      } else {
        await api("/api/auth/login", { method: "POST", body: JSON.stringify(data) });
        window.location.href = "/";
      }
    } catch (error) {
      setMessage(error.message);
      button.disabled = false;
    }
  });
  document.querySelector("#register-link").addEventListener("click", event => {
    event.preventDefault();
    mode = "register";
    form.innerHTML = '<label>Name<input name="name" autocomplete="name" minlength="2" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><button class="button button-dark" type="submit">Create account <span>→</span></button>';
    document.querySelector(".eyebrow").textContent = "A little home for your rituals";
    document.querySelector("h1").innerHTML = "Start your <em>ritual.</em>";
    document.querySelector(".auth-intro").textContent = "Create an account to keep your details close. You can always shop as a guest.";
    document.querySelector(".auth-switch").innerHTML = 'Already have an account? <a href="./login.html">Sign in</a>';
  });
})();
