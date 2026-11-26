const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createApp } = require("../server");

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("valid marketplace requests work and invalid input uses the shared error format", async () => {
  const createdResponse = await fetch(`${baseUrl}/api/v1/listings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sellerId: "seller-1",
      title: "Handmade mug",
      description: "A blue ceramic mug",
      category: "Home",
      price: 18.5,
      inventory: 4,
    }),
  });
  const created = await createdResponse.json();

  assert.equal(createdResponse.status, 201);
  assert.equal(created.data.title, "Handmade mug");
  assert.ok(createdResponse.headers.get("x-request-id"));
  const listingResponse = await fetch(`${baseUrl}${createdResponse.headers.get("location")}`);
  assert.equal((await listingResponse.json()).data.id, created.data.id);
  const listingId = created.data.id;

  const searchResponse = await fetch(`${baseUrl}/api/v1/listings?search=blue`);
  const search = await searchResponse.json();
  assert.equal(search.meta.count, 1);
  assert.equal(search.data[0].id, listingId);

  const invalidResponse = await fetch(`${baseUrl}/api/v1/listings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "x", price: -2, inventory: 0 }),
  });
  const invalid = await invalidResponse.json();
  assert.equal(invalidResponse.status, 400);
  assert.equal(invalid.error.code, "VALIDATION_ERROR");
  assert.ok(invalid.error.details.some((item) => item.field === "sellerId"));
  assert.ok(invalid.error.details.some((item) => item.field === "price"));
  assert.ok(invalid.error.requestId);

  const orderResponse = await fetch(`${baseUrl}/api/v1/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ buyerId: "buyer-1", listingId, quantity: 2 }),
  });
  const order = await orderResponse.json();
  assert.equal(orderResponse.status, 201);
  assert.equal(order.data.total, 37);
  assert.equal(order.data.status, "pending");

  const invalidStatusResponse = await fetch(
    `${baseUrl}/api/v1/orders/${order.data.id}/status`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "lost" }),
    }
  );
  const invalidStatus = await invalidStatusResponse.json();
  assert.equal(invalidStatusResponse.status, 400);
  assert.equal(invalidStatus.error.code, "VALIDATION_ERROR");

  const invalidTransitionResponse = await fetch(
    `${baseUrl}/api/v1/orders/${order.data.id}/status`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "delivered" }),
    }
  );
  const invalidTransition = await invalidTransitionResponse.json();
  assert.equal(invalidTransitionResponse.status, 409);
  assert.equal(invalidTransition.error.code, "INVALID_ORDER_TRANSITION");

  for (const status of ["paid", "shipped", "delivered"]) {
    const response = await fetch(`${baseUrl}/api/v1/orders/${order.data.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.data.status, status);
  }

  const cancelResponse = await fetch(`${baseUrl}/api/v1/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ buyerId: "buyer-2", listingId, quantity: 1 }),
  });
  const cancelOrder = await cancelResponse.json();
  const cancelledResponse = await fetch(
    `${baseUrl}/api/v1/orders/${cancelOrder.data.id}/status`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    }
  );
  assert.equal(cancelledResponse.status, 200);

  const listingAfterCancel = await fetch(`${baseUrl}${createdResponse.headers.get("location")}`);
  assert.equal((await listingAfterCancel.json()).data.inventory, 2);
});

test("malformed JSON is handled by the centralized error middleware", async () => {
  const response = await fetch(`${baseUrl}/api/v1/listings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"title":',
  });
  const result = await response.json();

  assert.equal(response.status, 400);
  assert.equal(result.error.code, "INVALID_JSON");
  assert.ok(result.error.requestId);
});
