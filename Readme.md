# Marketplace listings and orders

A small Express API for a local marketplace. It stores data in memory, so a restart clears listings and orders.

## Food delivery dashboard

The React dashboard is a standalone UI with sample food-delivery orders. Run it with `npm install` and `npm run dev`, then open the local URL printed by Vite. Verify the client with `npm run build`; run the existing API with `npm start` and its tests with `npm test`.

The dashboard owns order data, loading/error state, filters, and status/ETA updates. Reusable order cards, status badges, and summary cards receive data and callbacks as props. Its sample data service supports the `?demo=empty` and `?demo=error` query parameters to preview empty and error states; remove the parameter to return to the normal sample orders. Status changes and five-minute ETA adjustments are local demo interactions, not persisted to the API.

## Run and verify

```powershell
npm install
npm start
```

In another terminal:

```powershell
npm test
```

The tests start a real HTTP server and check successful requests, invalid listing fields, malformed JSON, search, and order status changes. A passing run prints `2` passing tests.

## Request flow

```text
HTTP request
    |
    v
Request ID + log middleware
    |
    v
JSON parser -> route validation -> marketplace route
                                  |
                                  v
                     centralized error handler
```

Every response includes an `X-Request-Id`. Errors share this shape so a caller can show field issues and support can find the matching log:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Listing details are invalid.",
    "details": [{ "field": "price", "issue": "must be a positive number" }],
    "requestId": "..."
  }
}
```

## Examples

Create a seller listing:

```http
POST /api/v1/listings
Content-Type: application/json

{
  "sellerId": "seller-1",
  "title": "Handmade mug",
  "description": "A blue ceramic mug",
  "category": "Home",
  "price": 18.5,
  "inventory": 4
}
```

The required fields are seller ID, a 3–100 character title, a description up to 500 characters, category, a positive price, and positive whole-number inventory. A valid listing returns `201 Created`.

Search available items with `GET /api/v1/listings?search=blue`.
The listing response includes a `Location` header; `GET /api/v1/listings/{listingId}` reads that listing.

Create an order with `POST /api/v1/orders`:

```json
{ "buyerId": "buyer-1", "listingId": "listing-1", "quantity": 2 }
```

An order begins as `pending`. Update it using `PATCH /api/v1/orders/order-1/status` and a JSON `status`. The allowed path is:

```text
pending -> paid -> shipped -> delivered
    |
    +----> cancelled
```

Only valid next steps are accepted. An unknown status returns `400 VALIDATION_ERROR`; attempting to move directly from `pending` to `delivered` returns `409 INVALID_ORDER_TRANSITION`. The quantity is reserved when the order is created and restored if a pending order is cancelled.

## Verified behavior

`npm test` exercises the HTTP API and confirms:

- Valid listing creation returns `201` and a request ID.
- A listing search finds the created item.
- Missing/invalid listing fields return `400 VALIDATION_ERROR` with field-level details.
- Malformed JSON returns `400 INVALID_JSON` from the centralized handler.
- An order is created with the correct total; invalid status input and skipping an order state return `400` and `409` respectively. Valid state changes succeed, and cancelling a pending order restores inventory.
