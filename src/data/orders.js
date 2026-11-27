const sampleOrders = [
  {
    id: "FD-2048",
    customer: "Maya Chen",
    items: ["Spicy tuna roll", "Miso soup", "Matcha latte"],
    address: "18 Willow Street",
    status: "preparing",
    etaMinutes: 18,
    total: 32.5,
    courier: "Alex Morgan",
  },
  {
    id: "FD-2047",
    customer: "Jordan Lee",
    items: ["Margherita pizza", "Garden salad"],
    address: "402 Pine Avenue",
    status: "ready",
    etaMinutes: 11,
    total: 27,
    courier: "Sam Rivera",
  },
  {
    id: "FD-2046",
    customer: "Avery Patel",
    items: ["Chicken shawarma bowl", "Hummus"],
    address: "7 Market Lane",
    status: "on-the-way",
    etaMinutes: 6,
    total: 24.75,
    courier: "Taylor Kim",
  },
  {
    id: "FD-2045",
    customer: "Riley Brooks",
    items: ["Mushroom ramen", "Edamame"],
    address: "95 Cedar Road",
    status: "delivered",
    etaMinutes: 0,
    total: 21.25,
    courier: "Jamie Park",
  },
];

export async function loadOrders(demoMode) {
  await new Promise((resolve) => window.setTimeout(resolve, 450));

  if (demoMode === "error") {
    throw new Error("The demo order service is unavailable.");
  }
  if (demoMode === "empty") {
    return [];
  }

  const now = Date.now();
  return sampleOrders.map((order) => ({
    ...order,
    items: [...order.items],
    etaAt:
      order.status === "delivered"
        ? null
        : new Date(now + order.etaMinutes * 60_000).toISOString(),
  }));
}
