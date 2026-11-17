export function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={`status-dot ${status}`}>
      <span className="sw" />
      {status.replace(/_/g, ' ')}
    </span>
  );
}
