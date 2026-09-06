import * as React from 'react';
import { cn } from '@/lib/utils';

/** Floating studio surface: translucent paper with a hairline and a soft shadow. `size="sm"` for pills. */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { size?: 'default' | 'sm' }>(({ className, size = 'default', ...props }, ref) => (
  <div ref={ref} className={cn('ui-surface', size === 'sm' ? 'rounded-[10px] shadow-[var(--shadow-sm)]' : 'rounded-[16px]', className)} {...props} />
));
Card.displayName = 'Card';

const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('flex flex-col gap-1 p-4 pb-2', className)} {...props} />;
const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('text-[14px] font-semibold leading-tight text-[var(--text-1)]', className)} {...props} />;
const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('text-[12px] leading-snug text-[var(--text-2)]', className)} {...props} />;
const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('p-4 pt-0', className)} {...props} />;
const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('flex items-center p-4 pt-0', className)} {...props} />;

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
