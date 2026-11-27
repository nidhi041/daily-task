const statusLabels = {
  preparing: "Preparing",
  ready: "Ready for pickup",
  "on-the-way": "On the way",
  delivered: "Delivered",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" aria-hidden="true" />
      {statusLabels[status] ?? status}
    </span>
  );
}
