import * as React from 'react';

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={['panel', className].filter(Boolean).join(' ')} {...props} />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={['panel-head', className].filter(Boolean).join(' ')} style={{ marginBottom: 0, ...props.style }} {...props} />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h2 ref={ref} className={className} style={{ margin: 0 }} {...props} />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={className} style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '4px 0 0' }} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={className} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={['flex items-center', className].filter(Boolean).join(' ')} {...props} />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
