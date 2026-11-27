export default function SummaryCard({ label, value, detail, icon, accent }) {
  return (
    <article className={`summary-card summary-${accent}`}>
      <div className="summary-topline">
        <span className="summary-label">{label}</span>
        <span className="summary-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className="summary-value">{value}</p>
      <p className="summary-detail">{detail}</p>
    </article>
  );
}
