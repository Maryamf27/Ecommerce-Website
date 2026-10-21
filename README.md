# R Audio e-commerce foundation

Responsive R Audio storefront built with Next.js App Router, TypeScript, Tailwind CSS 4, MongoDB, and Mongoose. Fake Store API data is imported into MongoDB; MongoDB remains the product catalog source for the storefront and CRUD API.

## Requirements and setup

- Node.js 20.9 or newer
- MongoDB running locally or a MongoDB Atlas connection string

Set `MONGODB_URI` in `.env.local` (or `.env` for local development). A local MongoDB example is `mongodb://127.0.0.1:27017/ecommerce`. For Atlas, use the database connection string from your cluster. Environment files are ignored by Git. `NEXT_PUBLIC_APP_URL` is reserved for later phases.

```bash
npm install
npm run dev
```

The navbar spans the viewport and its contents use a centered max-width container. The product grid adapts from four columns on desktop to two on small screens. Check `/api/health` for database status.

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

List sorting options are `newest`, `price_asc`, `price_desc`, and `rating_desc`; page size is capped at 48. Write endpoints return 403 outside development until admin authentication is implemented. They are not suitable for production admin use yet.

Product creation requires `title`, `description`, `price`, `category`, and an HTTP(S) `image` URL. `rating`, `stock`, and a positive integer `externalId` are optional. PATCH accepts `title`, `description`, `price`, `category`, `image`, `rating`, and `stock`. Editing an imported product field marks it as locally managed so future imports preserve that edit.

## Validation

```bash
npm run lint
npx tsc --noEmit
npm run build
```
