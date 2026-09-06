import * as React from 'react';
import { Progress as BaseProgress } from '@base-ui-components/react/progress';
import { cn } from '@/lib/utils';

interface ProgressProps extends Omit<React.ComponentProps<typeof BaseProgress.Root>, 'value'> { value: number | null; indicatorClassName?: string }
const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(({ className, indicatorClassName, value, ...props }, ref) => (
  <BaseProgress.Root ref={ref} value={value} className={cn('block', className)} {...props}>
    <BaseProgress.Track className="block h-1.5 w-full overflow-hidden rounded-full bg-[var(--hint-strong)]">
      <BaseProgress.Indicator className={cn('block h-full rounded-full bg-[var(--accent)] transition-[width] duration-150 ease-linear', indicatorClassName)} />
    </BaseProgress.Track>
  </BaseProgress.Root>
));
Progress.displayName = 'Progress';

export { Progress };
