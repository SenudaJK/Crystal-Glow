# Crystal Glow storefront preview

A static, responsive storefront prototype for a Sri Lankan skincare-mask shop. It uses browser-local JavaScript for the sample catalogue, filters, wishlist, cart, bundle builder and routine finder.

## Run locally

The storefront now includes an Express API and SQLite database for validated cash-on-delivery orders, stock reservation, separate shipping and billing addresses, newsletter subscriptions, optional account registration, and admin order/stock operations. Signed-in customers have their name and email prefilled and enforced during checkout.

From this folder, run:

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

Then open `http://localhost:4173`. Internet access is needed for the Google Fonts and illustrative Unsplash photos. Set a private `ADMIN_KEY` in `.env` before using the admin API.

To view the local database in Prisma Studio, open another Terminal window and run:

```bash
npm run db:studio
```

Then open the URL Prisma prints, usually `http://localhost:5555`. You can browse Products, Orders, OrderItems, Customers, Sessions and NewsletterSubscribers there. You can also inspect the raw SQLite file with:

```bash
sqlite3 prisma/dev.db
```

Useful SQLite queries:

```sql
.tables
SELECT * FROM "Product";
SELECT * FROM "Order";
SELECT * FROM "OrderItem";
SELECT * FROM "Customer";
SELECT * FROM "NewsletterSubscriber";
.quit
```

Admin API examples:

```bash
curl -H "x-admin-key: $ADMIN_KEY" http://localhost:4173/api/admin/orders
curl -X PATCH -H "x-admin-key: $ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"stock":20}' http://localhost:4173/api/admin/products/1
```

## Project files

- `dist/index.html` — page structure and content
- `dist/styles.css` — responsive design
- `dist/app.js` — sample catalogue and browser interactions; the `CONFIG` object contains the placeholder brand and free-delivery setting
- `server.js` — order, stock, newsletter, account and admin APIs
- `prisma/schema.prisma` — database schema
- `dist/login.html` — customer sign-in and registration page
- `.openai/hosting.json` — static Site hosting manifest

## Before accepting real orders

This is still an MVP, not a production launch. Product names, prices, images, ingredients, origin, expiry, stock and all claims are sample content and must be verified and replaced. Add a production database, HTTPS, robust customer sessions/password reset, rate limiting, CSRF protection, email delivery, backups, monitoring and a merchant-onboarded payment provider before accepting real orders at scale. The current checkout uses cash on delivery only.

## Deploy the website to GitHub Pages

The workflow in `.github/workflows/static.yml` publishes only the `dist/` folder, so GitHub Pages serves the storefront instead of the repository README.

1. Push the workflow change to `main`.
2. In GitHub, open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Open **Actions** and wait for **Deploy static content to Pages** to complete.
5. Open the URL shown under the workflow’s `github-pages` environment.

For this repository, the project-site URL is:

`https://senudajk.github.io/Crystal-Glow/`

If GitHub Pages is still configured as **Deploy from a branch**, the root `index.html` redirects to the storefront in `dist/`. The recommended setting remains **GitHub Actions**, which publishes `dist/` directly.

GitHub Pages hosts static files only. It cannot run `server.js`, Prisma, SQLite, customer login, stock validation, newsletter persistence, or order creation. Those backend features require a separate Node.js hosting service and a production database. The hosted GitHub Pages version is therefore the static storefront preview; keep using the local Express server for the full checkout MVP until the backend is deployed separately.

The hosted version still includes the account button and [login.html](./dist/login.html) page, but sign-in and registration remain disabled there until the backend is deployed. The local version provides the complete account flow.
