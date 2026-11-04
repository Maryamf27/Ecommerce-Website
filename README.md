# Nexora e-commerce storefront

Responsive general-purpose Nexora storefront built with Next.js App Router, TypeScript, Tailwind CSS 4, MongoDB, and Mongoose. Mixed-category Fake Store API data is imported into MongoDB; MongoDB remains the product catalog source for the storefront and product API.

## Requirements and setup

- Node.js 20.9 or newer
- MongoDB running locally or a MongoDB Atlas connection string

Copy `.env.example` to `.env.local` for local development. Set `MONGODB_URI` to a development-only MongoDB database and use Stripe test credentials. For staging and production, configure variables in separate Vercel environments as described in [Environment configuration](#environment-configuration). Never commit real credentials.

```bash
npm install
npm run dev
```

The navbar spans the viewport and its contents use a centered max-width container. The storefront provides API-backed search, category filtering, sorting, pagination, and product detail pages. Check `/api/health` for database status.

Shopping carts and wishlists are available at `/cart` and `/wishlist`. Guests keep only product IDs and quantities in browser local storage; current product information and prices are resolved from MongoDB. Signed-in users' carts and wishlists are stored in per-user MongoDB documents and guest data is merged into the account after sign-in. Cart and wishlist API mutations validate product identifiers and quantities on the server.

## Environment configuration

The checked-in `.env.example`, `.env.staging.example`, and `.env.production.example` files are variable-name templates only; they contain no credentials and are not loaded automatically. Local Next.js development reads `.env.local`. Set environment-specific values in Vercel project settings for deployed environments:

| Environment | Configuration | MongoDB | Stripe |
| --- | --- | --- | --- |
| Development | `.env.local` copied from `.env.example` | Local/dev-only database | Development test key and local webhook signing secret |
| Staging | Vercel Preview environment (or a dedicated staging project); use `.env.staging.example` as a checklist | Staging-only database/cluster | Staging test key and staging webhook signing secret |
| Production | Vercel Production environment; use `.env.production.example` as a checklist | Production-only database/cluster | Production test key and production webhook signing secret |

Use distinct `MONGODB_URI`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` values for each environment. Keep staging data and payment events isolated from production. Vercel environment variables are scoped to Development, Preview, or Production; after changing them, redeploy so the deployment picks up the new values. The application currently rejects Stripe live-mode keys (`sk_live_`), including in production. Do not enable live payments until that explicit product/security change is implemented and reviewed. CI tests mock external services and do not need any `.env` file or credentials.

## Checkout and Stripe test mode

Checkout at `/checkout` requires a signed-in customer. The server rechecks product prices and stock, then creates a Stripe-hosted Checkout Session using only a `sk_test_` key. The initial shipping/tax policy is explicitly $0 for both because no real rules are configured. The webhook marks orders paid and reconciles only purchased quantities from the cart after a verified Stripe event. Inventory is not reserved or decremented.

Required environment values:

- `STRIPE_SECRET_KEY`: Stripe test-mode secret beginning with `sk_test_` (server only).
- `STRIPE_WEBHOOK_SECRET`: signing secret for the webhook endpoint configured below (server only).
- `NEXT_PUBLIC_APP_URL`: canonical app origin, such as `http://localhost:3000` locally or the HTTPS storefront origin in production.
- `MONGODB_URI`: existing database connection.
- `APP_ORIGIN`: exact public origin(s) used to validate state-changing API requests (sign-in, registration, checkout, account and admin writes) in production. See "Origin validation" below.

For local webhook forwarding, install and authenticate the official Stripe CLI, run `stripe listen --forward-to localhost:3000/api/stripe/webhook`, and copy the `whsec_...` value it prints into `STRIPE_WEBHOOK_SECRET`. Restart the development server after changing env values. Configure the Stripe endpoint to receive `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, and `payment_intent.payment_failed`. PaymentIntent metadata carries the order and user association created by this app; the webhook also matches an order by its stored PaymentIntent ID. Failed payments keep the cart and show a safe retry message on the checkout result and order history. Use Stripe's test card details in test mode. Add the production endpoint `https://your-domain/api/stripe/webhook` and its separate signing secret to the production deployment environment; do not reuse the CLI secret. Redeploy Vercel after setting variables. Never use live keys with this test-only implementation.

Order and processed webhook event collections are created by Mongoose on first use. MongoDB must support transactions (for example, a replica set such as Atlas) because payment confirmation, inventory deduction, and cart reconciliation are committed atomically. Inventory is deducted only after verified payment. A concurrent payment that arrives after the final stock was sold is recorded as `inventory_issue`, keeps the cart, and requires manual review; the application does not automatically refund it. Checkout rejects items whose stock is zero or below the requested quantity.

## Inventory and demo stock

The Fake Store API does not supply stock. New imported demo products therefore receive the deterministic `DEMO_INITIAL_STOCK` quantity (default `12`), and imports preserve all existing stock. This quantity is demo data, not supplier inventory. `LOW_STOCK_THRESHOLD` (default `5`) controls when products show “Only X left”.

Run `npm run stock:backfill` for a read-only preview of existing product records. Run `npm run stock:backfill -- --apply` to fill missing/invalid stock and convert legacy untracked zero values into the configured demo quantity. Positive stock and zero stock explicitly set through the stock update API are preserved. The script changes only product stock metadata and timestamps; it does not delete products. Run it separately against the production database by using that environment's `MONGODB_URI`; local changes do not affect production.

Stock supplied on product creation or PATCH must be a non-negative integer. PATCHing stock marks it as explicitly managed so future migrations will preserve an intentional zero. Product writes require an admin account; see the Admin dashboard section.

## Admin dashboard

Visit `/admin` while signed in as an administrator. New accounts are always customers, so promote an existing account from the terminal:

```bash
npm run make:admin -- you@example.com
```

Sign out and back in afterwards. The dashboard lets admins add, edit and delete products (including image URL, stock and tags), manage tag names in the Tags tab, quick-edit stock, and move paid orders through Processing, Shipped and Delivered. Tags appear on product cards and product detail pages; a tag can only be deleted after it is unassigned from all products. Product write APIs (`POST`, `PATCH`, `DELETE`) now require an admin session instead of being development-only, and write requests must match `APP_ORIGIN` in production. Refunds and cancellations are done in the Stripe dashboard and do not restock automatically.

## Customer account

`/account` shows recent orders, order totals, a saved delivery address (pre-filled at checkout) and a change-password form (other devices are signed out on change). `/orders` lists every order with a progress tracker. The header has a user menu for signed-in customers.

## Featured headphone (home hero)

The public Fake Store API has no headphones, so the hero headphone is a local product stored in MongoDB (`externalId` 1001, image `/headphone.png` from `public/`). The home page looks for an existing headphone product first and only adds it when none exists, so it is never duplicated. Clicking the big headphone image opens its product page, where customers can read the details and use "Continue shopping". To add it ahead of time, run:

```bash
npm run seed:headphone
```

Admins are not customers: the admin dashboard has its own header, and administrator accounts have no cart, wishlist, checkout or customer orders (the pages redirect to `/admin` and the APIs return 403).

## Import sample products

With MongoDB available and `MONGODB_URI` configured, run:

```bash
npm run import:products
```

The script validates the upstream response and upserts by `externalId`, so repeated runs do not duplicate imported products. It refreshes imported product fields while preserving stock and fields locally edited through PATCH. Invalid individual items are skipped; a failed request or malformed top-level response stops the import.

## Product API

- `GET /api/products?page=1&limit=12&search=audio&category=electronics&minPrice=5&maxPrice=500&sort=price_asc`
- `GET /api/products/:id` where `:id` is a MongoDB ObjectId or an external Fake Store product ID
- `POST /api/products`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`

List sorting options are `newest`, `price_asc`, `price_desc`, and `rating_desc`; page size is capped at 48. Write endpoints require an admin session and return 401/403 otherwise.

Product creation requires `title`, `description`, `price`, `category`, and an HTTP(S) `image` URL. `rating`, `stock`, and a positive integer `externalId` are optional. PATCH accepts `title`, `description`, `price`, `category`, `image`, `rating`, and `stock`. Editing an imported product field marks it as locally managed so future imports preserve that edit.

## Authentication

Copy `.env.example` to `.env.local` and set `MONGODB_URI`. Set `APP_ORIGIN` to the exact public origin in production (for example, `https://shop.example.com`); auth-changing requests fail closed in production if it is missing. No static session-signing secret is required: sessions use cryptographically random, opaque tokens, store only SHA-256 token hashes in MongoDB, and are revoked server-side on sign-out. The browser cookie is HTTP-only, SameSite Lax, path-wide, and Secure in production.

Registration and sign-in are available at `/register` and `/login`. Passwords must be at least 8 characters and fit bcrypt's 72-byte input limit; they are hashed with bcryptjs. New public accounts always receive the `customer` role. The account page at `/account` is checked on the server; `/api/auth/me` returns only the current user's public name, email, and ID.

Login allows five consecutive incorrect passwords before temporarily locking the account for 15 minutes. Further lockouts double in duration (30 minutes, 1 hour, and onward) up to 24 hours; a successful login or inactivity resets the escalation. The inactivity reset defaults to 24 hours after the lock expires and can be changed with `LOGIN_LOCKOUT_ESCALATION_RESET_HOURS` (a positive number). Lockout state and failed counters are stored in MongoDB under a one-way hash of the normalized email, so nonexistent emails follow the same failure and lockout responses; passwords are never recorded. A separate 300-attempt-per-15-minute IP limit reduces automated abuse without quickly throttling shared networks. Configure the production reverse proxy to overwrite `x-real-ip`/`x-forwarded-for` with trusted client addresses. Lockout responses use HTTP 429 and a `Retry-After` header. Product browsing APIs remain public.

## Origin validation (CSRF) and Vercel configuration

State-changing requests must carry an `Origin` header that matches a trusted origin; otherwise the API answers `403 Request origin could not be verified.` Trusted origins come only from server configuration (never from `Host`/`X-Forwarded-*` headers):

1. `APP_ORIGIN` - one exact origin, or several separated by commas, such as `https://shop.example.com,https://my-app.vercel.app`. Scheme and host must match exactly (`http` vs `https`, `www.` vs bare domain, and each `*.vercel.app` alias are all different origins). A trailing slash is ignored; wildcards are not supported.
2. On Vercel, the platform-provided `VERCEL_PROJECT_PRODUCTION_URL` is trusted automatically for production deployments.
3. Preview deployments are **not** trusted by default. Set `APP_ALLOW_VERCEL_PREVIEW=true` to also trust that preview deployment's own `VERCEL_URL`/`VERCEL_BRANCH_URL`.

With nothing configured in production, requests are rejected (fail closed). Rejections are logged on the server (`[origin] ... rejected: reason=... origin=... allowed=[...]`) to make misconfiguration easy to diagnose. After changing any variable on Vercel, redeploy - values are read from the deployment that was built with them.

## Validation and pull requests

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

`npm test` runs the existing Node test suite and the Jest suite. Jest/Supertest tests cover the auth HTTP routes; React Testing Library tests cover cart interactions and the product-catalog invalid-price-range regression. These tests use mocked API responses and need no database or Stripe credentials. GitHub Actions runs tests, lint, and TypeScript checks on every pull request; a failed required check should block merging.

To enforce that policy, configure the repository's branch protection/ruleset to require the `CI / test` status check before merging.
