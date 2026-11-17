export function EmptyState({ title = 'No data found', description, action }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 20px', textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/>
        </svg>
      </div>
      <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', margin: '0 0 6px' }}>{title}</p>
      {description && <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 16px', maxWidth: 320 }}>{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
