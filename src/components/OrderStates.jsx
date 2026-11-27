export function LoadingState() {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <span className="loader" aria-hidden="true" />
      <h2>Getting orders ready</h2>
      <p>Loading the latest delivery updates…</p>
    </div>
  );
}

export function EmptyState({ title, message, actionLabel, onAction }) {
  return (
    <div className="state-panel">
      <span className="state-illustration" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none">
          <path d="M12 19h24l-2 19H14l-2-19Z" />
          <path d="M18 19a6 6 0 0 1 12 0M18 27h12" />
        </svg>
      </span>
      <h2>{title}</h2>
      <p>{message}</p>
      {onAction && (
        <button className="button button-secondary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state-panel error-panel" role="alert">
      <span className="error-icon" aria-hidden="true">
        !
      </span>
      <h2>We couldn’t load orders</h2>
      <p>{message}</p>
      <button className="button button-primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
