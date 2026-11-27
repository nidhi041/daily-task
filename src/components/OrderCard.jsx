import StatusBadge from "./StatusBadge.jsx";

const nextStatus = {
  preparing: { value: "ready", label: "Mark ready" },
  ready: { value: "on-the-way", label: "Mark picked up" },
  "on-the-way": { value: "delivered", label: "Mark delivered" },
};

function getEtaLabel(order, now) {
  if (order.status === "delivered") return "Delivered";
  const minutes = Math.max(0, Math.ceil((Date.parse(order.etaAt) - now) / 60_000));
  return minutes === 0 ? "Arriving now" : `About ${minutes} min`;
}

export default function OrderCard({ order, now, onAdvanceStatus, onExtendEta }) {
  const next = nextStatus[order.status];

  return (
    <article className="order-card">
      <div className="order-card-heading">
        <div>
          <p className="order-number">Order {order.id}</p>
          <h3>{order.customer}</h3>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="order-details">
        <p className="order-items">{order.items.join(" · ")}</p>
        <p className="order-address">{order.address}</p>
      </div>

      <div className="order-meta">
        <div className="eta-block">
          <span className="meta-label">Estimated arrival</span>
          <strong>{getEtaLabel(order, now)}</strong>
        </div>
        <div className="courier-block">
          <span className="meta-label">Courier</span>
          <strong>{order.courier}</strong>
        </div>
        <strong className="order-total">${order.total.toFixed(2)}</strong>
      </div>

      {order.status !== "delivered" && (
        <div className="order-actions">
          {next && (
            <button
              className="button button-primary"
              onClick={() => onAdvanceStatus(order.id, next.value)}
            >
              {next.label}
            </button>
          )}
          <button
            className="button button-secondary"
            onClick={() => onExtendEta(order.id)}
          >
            Add 5 min to ETA
          </button>
        </div>
      )}
    </article>
  );
}
