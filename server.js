const express = require("express");
const { randomUUID } = require("node:crypto");

class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function requestLogger(req, res, next) {
  req.requestId = randomUUID();
  req.startedAt = Date.now();
  res.setHeader("X-Request-Id", req.requestId);

  res.on("finish", () => {
    console.log(
      `${req.requestId} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - req.startedAt}ms`
    );
  });

  next();
}

function validateListing(req, res, next) {
  const { sellerId, title, description, category, price, inventory } = req.body || {};
  const details = [];

  if (typeof sellerId !== "string" || !sellerId.trim()) {
    details.push({ field: "sellerId", issue: "is required" });
  }
  if (typeof title !== "string" || title.trim().length < 3 || title.trim().length > 100) {
    details.push({ field: "title", issue: "must be between 3 and 100 characters" });
  }
  if (
    typeof description !== "string" ||
    description.trim().length < 1 ||
    description.trim().length > 500
  ) {
    details.push({ field: "description", issue: "must be between 1 and 500 characters" });
  }
  if (typeof category !== "string" || !category.trim()) {
    details.push({ field: "category", issue: "is required" });
  }
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    details.push({ field: "price", issue: "must be a positive number" });
  }
  if (!Number.isInteger(inventory) || inventory < 1) {
    details.push({ field: "inventory", issue: "must be a positive whole number" });
  }

  if (details.length) {
    return next(
      new ApiError(400, "VALIDATION_ERROR", "Listing details are invalid.", details)
    );
  }

  next();
}

function validateOrder(req, res, next) {
  const { buyerId, listingId, quantity } = req.body || {};
  const details = [];

  if (typeof buyerId !== "string" || !buyerId.trim()) {
    details.push({ field: "buyerId", issue: "is required" });
  }
  if (typeof listingId !== "string" || !listingId.trim()) {
    details.push({ field: "listingId", issue: "is required" });
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    details.push({ field: "quantity", issue: "must be a positive whole number" });
  }

  if (details.length) {
    return next(new ApiError(400, "VALIDATION_ERROR", "Order details are invalid.", details));
  }

  next();
}

function validateOrderStatus(req, res, next) {
  const statuses = ["paid", "shipped", "delivered", "cancelled"];
  const status = req.body && req.body.status;

  if (!statuses.includes(status)) {
    return next(
      new ApiError(400, "VALIDATION_ERROR", "Order status is invalid.", [
        { field: "status", issue: `must be one of: ${statuses.join(", ")}` },
      ])
    );
  }

  next();
}

function createApp() {
  const app = express();
  const listings = [];
  const orders = [];
  let nextListingId = 1;
  let nextOrderId = 1;

  app.use(requestLogger);
  app.use(express.json({ limit: "1mb" }));

  app.post("/api/v1/listings", validateListing, (req, res) => {
    const listing = {
      id: `listing-${nextListingId++}`,
      sellerId: req.body.sellerId.trim(),
      title: req.body.title.trim(),
      description: req.body.description.trim(),
      category: req.body.category.trim(),
      price: req.body.price,
      inventory: req.body.inventory,
    };

    listings.push(listing);
    res.status(201).location(`/api/v1/listings/${listing.id}`).json({ data: listing });
  });

  app.get("/api/v1/listings", (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
    const results = listings.filter((listing) => {
      const matchesSearch =
        !search ||
        listing.title.toLowerCase().includes(search) ||
        listing.description.toLowerCase().includes(search);
      return matchesSearch && listing.inventory > 0;
    });

    res.json({ data: results, meta: { count: results.length } });
  });

  app.get("/api/v1/listings/:listingId", (req, res, next) => {
    const listing = listings.find((item) => item.id === req.params.listingId);
    if (!listing) {
      return next(new ApiError(404, "LISTING_NOT_FOUND", "That listing does not exist."));
    }

    res.json({ data: listing });
  });

  app.post("/api/v1/orders", validateOrder, (req, res, next) => {
    const listing = listings.find((item) => item.id === req.body.listingId);
    if (!listing) {
      return next(new ApiError(404, "LISTING_NOT_FOUND", "That listing does not exist."));
    }
    if (listing.inventory < req.body.quantity) {
      return next(new ApiError(409, "INSUFFICIENT_INVENTORY", "Not enough items are available."));
    }

    listing.inventory -= req.body.quantity;
    const order = {
      id: `order-${nextOrderId++}`,
      buyerId: req.body.buyerId.trim(),
      listingId: listing.id,
      quantity: req.body.quantity,
      total: Number((listing.price * req.body.quantity).toFixed(2)),
      status: "pending",
    };

    orders.push(order);
    res.status(201).location(`/api/v1/orders/${order.id}`).json({ data: order });
  });

  app.get("/api/v1/orders/:orderId", (req, res, next) => {
    const order = orders.find((item) => item.id === req.params.orderId);
    if (!order) {
      return next(new ApiError(404, "ORDER_NOT_FOUND", "That order does not exist."));
    }

    res.json({ data: order });
  });

  app.patch("/api/v1/orders/:orderId/status", validateOrderStatus, (req, res, next) => {
    const order = orders.find((item) => item.id === req.params.orderId);
    if (!order) {
      return next(new ApiError(404, "ORDER_NOT_FOUND", "That order does not exist."));
    }

    const allowedNextStates = {
      pending: ["paid", "cancelled"],
      paid: ["shipped"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: [],
    };
    const nextStatus = req.body.status;

    if (!allowedNextStates[order.status].includes(nextStatus)) {
      return next(
        new ApiError(409, "INVALID_ORDER_TRANSITION", `An order cannot move from ${order.status} to ${nextStatus || "an empty status"}.`)
      );
    }

    if (nextStatus === "cancelled") {
      const listing = listings.find((item) => item.id === order.listingId);
      listing.inventory += order.quantity;
    }
    order.status = nextStatus;
    res.json({ data: order });
  });

  app.use((req, res, next) => {
    next(new ApiError(404, "NOT_FOUND", "The requested route does not exist."));
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const isJsonError = error.type === "entity.parse.failed";
    const isPayloadTooLarge = error.type === "entity.too.large";
    const status = isJsonError ? 400 : isPayloadTooLarge ? 413 : error.status || 500;
    const code = isJsonError
      ? "INVALID_JSON"
      : isPayloadTooLarge
        ? "PAYLOAD_TOO_LARGE"
        : error.code || "INTERNAL_ERROR";
    const message =
      isJsonError
        ? "Request body must contain valid JSON."
        : isPayloadTooLarge
          ? "Request body must be no larger than 1 MB."
          : error.status
            ? error.message
            : "An unexpected error occurred.";
    const response = {
      error: {
        code,
        message,
        requestId: req.requestId,
      },
    };

    if (error.details && error.details.length) {
      response.error.details = error.details;
    }

    res.status(status).json(response);
  });

  return app;
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => {
    console.log(`Marketplace API listening at http://localhost:${port}`);
  });
}

module.exports = { createApp };
