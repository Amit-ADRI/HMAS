export function StatCard({ label, value, variant }) {
  const cls = variant === 'amber' ? 'amber' : variant === 'rose' ? 'rose' : '';
  return (
    <div className="tile">
      <div className={`num ${cls}`}>{value ?? '—'}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}
