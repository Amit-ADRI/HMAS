import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

const variantClass = {
  default: 'btn btn-primary',
  primary: 'btn btn-primary',
  destructive: 'btn btn-danger',
  outline: 'btn btn-ghost',
  secondary: 'btn btn-ghost',
  ghost: 'btn btn-ghost',
  link: 'link-btn',
};
const sizeClass = {
  default: '',
  sm: 'btn-sm',
  lg: '',
  icon: 'btn-icon',
};

// Base style for icon buttons — inline styles beat CSS class cascade issues
const ICON_BTN_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
  padding: 0,
  background: 'transparent',
  color: 'var(--ink-soft)',
  flexShrink: 0,
  transition: 'color 0.1s, background 0.1s',
};

const Button = React.forwardRef(({ className, variant = 'default', size = 'default', asChild = false, style, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  const cls = [variantClass[variant] || 'btn btn-primary', sizeClass[size] || '', className || ''].filter(Boolean).join(' ');
  const mergedStyle = size === 'icon' ? { ...ICON_BTN_STYLE, ...style } : style;
  return <Comp ref={ref} className={cls} style={mergedStyle} {...props} />;
});
Button.displayName = 'Button';
export { Button };
