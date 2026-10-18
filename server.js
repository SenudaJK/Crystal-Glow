const express = require("express");
const path = require("path");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.PORT || 4173);
const freeDeliveryThreshold = 5000;
const deliveryFee = 350;
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || "http://localhost:4173").split(",").map(origin => origin.trim()).filter(Boolean));

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(origin && allowedOrigins.has(origin) ? 204 : 403);
  next();
});
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "dist")));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }));

const validEmail = value => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const positiveInteger = value => Number.isInteger(value) && value > 0;
const publicProduct = product => ({ ...product, createdAt: undefined, updatedAt: undefined });
const hashPassword = password => crypto.scryptSync(password, "crystal-glow-password-salt", 64).toString("hex");
const passwordMatches = (password, passwordHash) => crypto.timingSafeEqual(Buffer.from(hashPassword(password), "hex"), Buffer.from(passwordHash, "hex"));
const sessionCookie = "cg_session";
const sessionMaxAge = 7 * 24 * 60 * 60 * 1000;
const parseCookies = header => Object.fromEntries((header || "").split(";").filter(Boolean).map(part => {
  const index = part.indexOf("=");
  return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
}));
const cookieAttributes = () => `HttpOnly; SameSite=${process.env.NODE_ENV === "production" ? "None" : "Lax"}; Path=/; Max-Age=${sessionMaxAge / 1000}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
const setSessionCookie = (res, token) => res.setHeader("Set-Cookie", `${sessionCookie}=${encodeURIComponent(token)}; ${cookieAttributes()}`);
const clearSessionCookie = res => res.setHeader("Set-Cookie", `${sessionCookie}=; HttpOnly; SameSite=${process.env.NODE_ENV === "production" ? "None" : "Lax"}; Path=/; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
const sessionIdFromRequest = req => {
  const token = parseCookies(req.headers.cookie)[sessionCookie];
  return token ? crypto.createHash("sha256").update(token).digest("hex") : null;
};
const authenticatedCustomer = async req => {
  const id = sessionIdFromRequest(req);
  if (!id) return null;
  const session = await prisma.session.findUnique({ where: { id }, include: { customer: true } });
  return session && session.expiresAt > new Date() ? session.customer : null;
};

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/api/products", async (_req, res) => {
  res.json(await prisma.product.findMany({ where: { active: true }, orderBy: { id: "asc" } }));
});

app.post("/api/orders", async (req, res) => {
  const { customer, items } = req.body || {};
  const signedInCustomer = await authenticatedCustomer(req);
  const orderCustomer = signedInCustomer ? { ...customer, name: signedInCustomer.name, email: signedInCustomer.email } : customer;
  const shippingAddress = orderCustomer?.shippingAddress || orderCustomer?.address;
  const billingAddress = orderCustomer?.billingAddress || shippingAddress;
  const shippingCity = orderCustomer?.shippingCity || orderCustomer?.city;
  const billingCity = orderCustomer?.billingCity || shippingCity;
  const shippingPostalCode = orderCustomer?.shippingPostalCode || orderCustomer?.postalCode;
  const billingPostalCode = orderCustomer?.billingPostalCode || shippingPostalCode;
  if (!orderCustomer || !validEmail(orderCustomer.email) || typeof orderCustomer.name !== "string" || orderCustomer.name.trim().length < 2 ||
      typeof orderCustomer.phone !== "string" || orderCustomer.phone.trim().length < 7 || typeof shippingAddress !== "string" ||
      shippingAddress.trim().length < 5 || typeof shippingCity !== "string" || shippingCity.trim().length < 2 ||
      typeof shippingPostalCode !== "string" || shippingPostalCode.trim().length < 3 ||
      typeof billingAddress !== "string" || billingAddress.trim().length < 5 ||
      typeof billingCity !== "string" || billingCity.trim().length < 2 ||
      typeof billingPostalCode !== "string" || billingPostalCode.trim().length < 3) {
    return res.status(400).json({ error: "Enter valid contact details, shipping address and billing address." });
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 50 ||
      items.some(item => !positiveInteger(item.productId) || !positiveInteger(item.quantity) || item.quantity > 20)) {
    return res.status(400).json({ error: "Your cart contains invalid items." });
  }

  const quantities = new Map();
  for (const item of items) quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  const products = await prisma.product.findMany({ where: { id: { in: [...quantities.keys()] }, active: true } });
  if (products.length !== quantities.size) return res.status(400).json({ error: "One or more products are unavailable." });
  for (const product of products) {
    if (quantities.get(product.id) > product.stock) {
      return res.status(409).json({ error: `${product.name} does not have enough stock.` });
    }
  }
  const orderItems = products.map(product => ({
    productId: product.id,
    name: product.name,
    unitPrice: product.price,
    quantity: quantities.get(product.id)
  }));
  const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const order = await prisma.$transaction(async transaction => {
    for (const item of orderItems) {
      const updated = await transaction.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } }
      });
      if (updated.count !== 1) throw new Error("STOCK_CHANGED");
    }
    return transaction.order.create({
      data: {
        customerEmail: orderCustomer.email.trim().toLowerCase(),
        customerName: orderCustomer.name.trim(),
        phone: orderCustomer.phone.trim(),
        address: shippingAddress.trim(),
        city: shippingCity.trim(),
        postalCode: shippingPostalCode.trim(),
        billingAddress: billingAddress.trim(),
        billingCity: billingCity.trim(),
        billingPostalCode: billingPostalCode.trim(),
        subtotal,
        deliveryFee: subtotal >= freeDeliveryThreshold ? 0 : deliveryFee,
        total: subtotal + (subtotal >= freeDeliveryThreshold ? 0 : deliveryFee),
        items: { create: orderItems }
      },
      include: { items: true }
    });
  }).catch(error => error.message === "STOCK_CHANGED" ? null : Promise.reject(error));
  if (!order) return res.status(409).json({ error: "Stock changed while placing the order. Please review your cart." });
  res.status(201).json({ orderId: order.id, status: order.status, total: order.total });
});

app.post("/api/newsletter", async (req, res) => {
  const email = req.body?.email;
  if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
  await prisma.newsletterSubscriber.upsert({ where: { email: email.toLowerCase() }, update: {}, create: { email: email.toLowerCase() } });
  res.status(201).json({ subscribed: true });
});

app.post("/api/auth/register", async (req, res) => {
  const { email, name, password } = req.body || {};
  if (!validEmail(email) || typeof name !== "string" || name.trim().length < 2 || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Use a valid email, name and password of at least 8 characters." });
  }
  try {
    const customer = await prisma.customer.create({ data: { email: email.toLowerCase(), name: name.trim(), passwordHash: hashPassword(password) } });
    res.status(201).json({ customer: { id: customer.id, email: customer.email, name: customer.name } });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "An account with that email already exists." });
    throw error;
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!validEmail(email) || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Enter a valid email and password." });
  }
  const customer = await prisma.customer.findUnique({ where: { email: email.toLowerCase() } });
  if (!customer || !passwordMatches(password, customer.passwordHash)) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({ data: { id: crypto.createHash("sha256").update(token).digest("hex"), customerId: customer.id, expiresAt: new Date(Date.now() + sessionMaxAge) } });
  setSessionCookie(res, token);
  res.json({ customer: { id: customer.id, email: customer.email, name: customer.name } });
});

app.post("/api/auth/logout", async (req, res) => {
  const token = parseCookies(req.headers.cookie)[sessionCookie];
  if (token) await prisma.session.deleteMany({ where: { id: crypto.createHash("sha256").update(token).digest("hex") } });
  clearSessionCookie(res);
  res.status(204).end();
});

app.get("/api/auth/me", async (req, res) => {
  const token = parseCookies(req.headers.cookie)[sessionCookie];
  if (!token) return res.status(401).json({ error: "Not signed in." });
  const session = await prisma.session.findUnique({ where: { id: crypto.createHash("sha256").update(token).digest("hex") }, include: { customer: true } });
  if (!session || session.expiresAt <= new Date()) {
    clearSessionCookie(res);
    return res.status(401).json({ error: "Not signed in." });
  }
  res.json({ customer: { id: session.customer.id, email: session.customer.email, name: session.customer.name } });
});

function adminOnly(req, res, next) {
  if (!process.env.ADMIN_KEY || process.env.ADMIN_KEY === "replace-with-a-long-random-value" ||
      req.get("x-admin-key") !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Admin authentication required." });
  }
  next();
}
app.get("/api/admin/orders", adminOnly, async (_req, res) => res.json(await prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } })));
app.patch("/api/admin/orders/:id", adminOnly, async (req, res) => {
  const allowed = ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled"];
  if (!allowed.includes(req.body?.status)) return res.status(400).json({ error: "Invalid order status." });
  res.json(await prisma.order.update({ where: { id: req.params.id }, data: { status: req.body.status } }));
});
app.patch("/api/admin/products/:id", adminOnly, async (req, res) => {
  const stock = req.body?.stock;
  if (!Number.isInteger(stock) || stock < 0) return res.status(400).json({ error: "Stock must be a non-negative integer." });
  res.json(await prisma.product.update({ where: { id: Number(req.params.id) }, data: { stock } }));
});

app.get("/login", (_req, res) => res.sendFile(path.join(__dirname, "dist", "login.html")));
app.use((_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "The server could not complete that request." });
});
app.listen(port, () => console.log(`Crystal Glow running at http://localhost:${port}`));
