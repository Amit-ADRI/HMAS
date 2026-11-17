import * as React from 'react';

function Badge({ className, variant = 'default', children, ...props }) {
  // Map variant to dot color
  const dotColor = variant === 'destructive' ? 'var(--rose)' : variant === 'warning' ? 'var(--amber)' : 'var(--teal)';
  const textColor = variant === 'destructive' ? '#7a3530' : variant === 'warning' ? '#8c6323' : 'var(--teal-deep)';

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: textColor }} className={className} {...props}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0, display: 'inline-block' }} />
      {children}
    </span>
  );
}
export { Badge };
