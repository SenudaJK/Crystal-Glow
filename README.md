# Crystal Glow storefront preview

A static, responsive storefront prototype for a Sri Lankan skincare-mask shop. It uses browser-local JavaScript for the sample catalogue, filters, wishlist, cart, bundle builder and routine finder.

## Run locally

The storefront now includes an Express API and PostgreSQL database for validated cash-on-delivery orders, stock reservation, separate shipping and billing addresses, newsletter subscriptions, optional account registration, and admin order/stock operations. Signed-in customers have their name and email prefilled and enforced during checkout.

From this folder, run:

```bash
npm install
cp .env.example .env
# Set DATABASE_URL to a PostgreSQL connection string in .env
npm run db:push
npm run db:seed
npm run dev
```

Then open `http://localhost:4173`. Internet access is needed for the Google Fonts and illustrative Unsplash photos. Set a private `ADMIN_KEY` in `.env` before using the admin API.

To view the PostgreSQL database in Prisma Studio, open another Terminal window and run:

```bash
npm run db:studio
```

Then open the URL Prisma prints, usually `http://localhost:5555`. You can browse Products, Orders, OrderItems, Customers, Sessions and NewsletterSubscribers there. Useful queries:

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

## Deploy the backend to Render

The backend is configured for Render in [render.yaml](./render.yaml).

1. Create a PostgreSQL database on Neon, Render, or another PostgreSQL provider.
2. Copy its connection string, including `sslmode=require`.
3. Create a Render **Web Service** from this GitHub repository, or use **Blueprints** and select `render.yaml`.
4. Set these Render environment variables:
   - `DATABASE_URL` — your PostgreSQL connection string
   - `ADMIN_KEY` — a long random secret
   - `ALLOWED_ORIGINS` — `https://senudajk.github.io,http://localhost:4173`
   - `NODE_ENV` — `production`
5. Deploy and verify:

```bash
curl https://YOUR-RENDER-SERVICE.onrender.com/health
```

Expected response:

```json
{"ok":true}
```

6. Edit [dist/config.js](./dist/config.js) and set:

```js
window.CG_API_URL = "https://YOUR-RENDER-SERVICE.onrender.com";
```

7. Commit and push that frontend change. GitHub Pages will then use the deployed API for login, checkout, stock, newsletter, and account sessions.

For automatic Render deploys, create a Render deploy hook and add it to GitHub as the repository secret `RENDER_DEPLOY_HOOK_URL`. The [deploy-backend.yml](./.github/workflows/deploy-backend.yml) workflow will trigger it when backend files change.

The first Render build runs `prisma db push` and the seed script. Replace the sample catalogue before production and use a proper migration process for later schema changes.

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

GitHub Pages hosts static files only. It cannot run `server.js`, Prisma, PostgreSQL, customer login, stock validation, newsletter persistence, or order creation. Those backend features run on Render and PostgreSQL after the API URL is configured.

If `dist/config.js` has an empty API URL, the hosted version shows the account page but keeps sign-in and registration disabled. Set the deployed Render URL there to enable the complete account flow.
