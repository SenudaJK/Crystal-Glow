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
