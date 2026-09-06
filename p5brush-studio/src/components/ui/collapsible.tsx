import * as React from 'react';
import { Collapsible as BaseCollapsible } from '@base-ui-components/react/collapsible';
import { cn } from '@/lib/utils';

interface CollapsibleProps extends Omit<React.ComponentProps<typeof BaseCollapsible.Root>, 'onOpenChange'> { onOpenChange?: (open: boolean) => void }
const Collapsible = ({ onOpenChange, ...props }: CollapsibleProps) => <BaseCollapsible.Root onOpenChange={(o) => onOpenChange?.(o)} {...props} />;

const CollapsibleTrigger = BaseCollapsible.Trigger;

const CollapsibleContent = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof BaseCollapsible.Panel>>(({ className, ...props }, ref) => (
  <BaseCollapsible.Panel
    ref={ref}
    className={cn('h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[starting-style]:h-0 data-[ending-style]:h-0', className)}
    {...props}
  />
));
CollapsibleContent.displayName = 'CollapsibleContent';

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
