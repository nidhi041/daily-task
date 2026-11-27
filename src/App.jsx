import { useCallback, useEffect, useMemo, useState } from "react";
import OrderCard from "./components/OrderCard.jsx";
import { EmptyState, ErrorState, LoadingState } from "./components/OrderStates.jsx";
import SummaryCard from "./components/SummaryCard.jsx";
import { loadOrders } from "./data/orders.js";

const filters = [
  { value: "all", label: "All orders" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "on-the-way", label: "On the way" },
  { value: "delivered", label: "Delivered" },
];

function getDemoMode() {
  return new URLSearchParams(window.location.search).get("demo");
}

export default function App() {
  const [orders, setOrders] = useState([]);
  const [requestState, setRequestState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [now, setNow] = useState(Date.now());
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
    .format(new Date())
    .toUpperCase();

  const refreshOrders = useCallback(async () => {
    setRequestState("loading");
    setErrorMessage("");
    try {
      const result = await loadOrders(getDemoMode());
      setNow(Date.now());
      setOrders(result);
      setRequestState("success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Please try again.");
      setRequestState("error");
    }
  }, []);

  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timerId);
  }, []);

  const visibleOrders = useMemo(
    () =>
      orders.filter((order) => activeFilter === "all" || order.status === activeFilter),
    [activeFilter, orders]
  );
  const activeOrders = orders.filter((order) => order.status !== "delivered");
  const averageEta = activeOrders.length
    ? Math.round(
        activeOrders.reduce(
          (total, order) => total + Math.max(0, (Date.parse(order.etaAt) - now) / 60_000),
          0
        ) / activeOrders.length
      )
    : 0;

  function advanceStatus(orderId, status) {
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, status } : order))
    );
  }

  function extendEta(orderId) {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId || !order.etaAt) return order;
        const baseTime = Math.max(Date.parse(order.etaAt), Date.now());
        return { ...order, etaAt: new Date(baseTime + 5 * 60_000).toISOString() };
      })
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Dash home">
          <span className="brand-mark" aria-hidden="true">d</span>
          <span>dash<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-context">
          <span className="live-indicator" />
          <span>Operations overview</span>
        </div>
        <div className="user-avatar" aria-label="Signed in as Alex">
          A
        </div>
      </header>

      <section className="dashboard">
        <div className="page-heading">
          <div>
            <p className="eyebrow">{today}</p>
            <h1>Good afternoon, Alex <span aria-hidden="true">✦</span></h1>
            <p className="page-subtitle">Here’s what’s happening with your deliveries today.</p>
          </div>
          <button
            className="button button-refresh"
            onClick={refreshOrders}
            disabled={requestState === "loading"}
          >
            <span aria-hidden="true">↻</span>
            Refresh orders
          </button>
        </div>

        {requestState === "success" && (
          <>
            <section className="summary-grid" aria-label="Order summary">
              <SummaryCard
                label="Active orders"
                value={activeOrders.length.toString().padStart(2, "0")}
                detail="Currently in progress"
                icon="↗"
                accent="orange"
              />
              <SummaryCard
                label="Avg. delivery time"
                value={`${averageEta} min`}
                detail="Across active deliveries"
                icon="◷"
                accent="blue"
              />
              <SummaryCard
                label="Delivered today"
                value={orders.filter((order) => order.status === "delivered").length.toString().padStart(2, "0")}
                detail="Orders completed"
                icon="✓"
                accent="green"
              />
            </section>

            <section className="orders-section" aria-labelledby="orders-heading">
              <div className="orders-heading">
                <div>
                  <h2 id="orders-heading">Live orders</h2>
                  <p>Track progress and keep customers in the loop.</p>
                </div>
                <span className="updated-note">
                  <span className="live-indicator" />
                  ETAs refresh live
                </span>
              </div>

              <div className="filter-list" role="group" aria-label="Filter orders">
                {filters.map((filter) => (
                  <button
                    className={`filter-button${activeFilter === filter.value ? " is-active" : ""}`}
                    key={filter.value}
                    onClick={() => setActiveFilter(filter.value)}
                    aria-pressed={activeFilter === filter.value}
                  >
                    {filter.label}
                    {filter.value === "all" && <span>{orders.length}</span>}
                  </button>
                ))}
              </div>

              {visibleOrders.length ? (
                <div className="order-list">
                  {visibleOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      now={now}
                      onAdvanceStatus={advanceStatus}
                      onExtendEta={extendEta}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={orders.length ? "No orders in this view" : "No orders right now"}
                  message={
                    orders.length
                      ? "Try another status filter to see more deliveries."
                      : "New orders will show up here as soon as they come in."
                  }
                  actionLabel={orders.length ? "Show all orders" : "Refresh"}
                  onAction={() =>
                    orders.length ? setActiveFilter("all") : refreshOrders()
                  }
                />
              )}
            </section>
          </>
        )}

        {requestState === "loading" && <LoadingState />}
        {requestState === "error" && (
          <ErrorState message={errorMessage} onRetry={refreshOrders} />
        )}
      </section>

      <footer className="app-footer">
        <span>Dash delivery operations</span>
        <span>Sample dashboard · Changes are local to this demo</span>
      </footer>
    </main>
  );
}
