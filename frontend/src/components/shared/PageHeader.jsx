export function PageHeader({ title, description, icon: Icon, children }) {
  return (
    <div className="stage-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 30 }}>
      <div>
        <h1 style={{ fontSize: 28, margin: '0 0 4px', color: 'var(--ink)' }}>{title}</h1>
        {description && (
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.55 }}>{description}</p>
        )}
      </div>
      {children && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginTop: 4 }}>{children}</div>
      )}
    </div>
  );
}
