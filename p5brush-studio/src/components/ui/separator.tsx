import * as React from 'react';
import { Separator as BaseSeparator } from '@base-ui-components/react/separator';
import { cn } from '@/lib/utils';

const Separator = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof BaseSeparator>>(({ className, orientation = 'horizontal', ...props }, ref) => (
  <BaseSeparator ref={ref} orientation={orientation} className={cn('shrink-0 bg-[var(--hint)]', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)} {...props} />
));
Separator.displayName = 'Separator';

export { Separator };
