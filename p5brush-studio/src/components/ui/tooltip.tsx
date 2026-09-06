import * as React from 'react';
import { Tooltip as BaseTooltip } from '@base-ui-components/react/tooltip';
import { cn } from '@/lib/utils';

/** Base UI tooltip with the shadcn component names. Triggers accept `asChild` (rendered via Base UI's `render`). */
const TooltipProvider = ({ delayDuration = 300, skipDelayDuration = 400, children }: { delayDuration?: number; skipDelayDuration?: number; children: React.ReactNode }) => (
  <BaseTooltip.Provider delay={delayDuration} closeDelay={0} timeout={skipDelayDuration}>{children}</BaseTooltip.Provider>
);

const Tooltip = BaseTooltip.Root;

function TooltipTrigger({ asChild, children, ...props }: React.ComponentProps<typeof BaseTooltip.Trigger> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) return <BaseTooltip.Trigger render={children as React.ReactElement<Record<string, unknown>>} {...props} />;
  return <BaseTooltip.Trigger {...props}>{children}</BaseTooltip.Trigger>;
}

interface TooltipContentProps extends React.ComponentProps<typeof BaseTooltip.Popup> {
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}
const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(({ side = 'top', align = 'center', sideOffset = 6, className, ...props }, ref) => (
  <BaseTooltip.Portal>
    <BaseTooltip.Positioner side={side} align={align} sideOffset={sideOffset} className="z-50 outline-none">
      <BaseTooltip.Popup
        ref={ref}
        className={cn(
          'ui-tooltip rounded-[8px] bg-[var(--ink)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--ink-fg)] shadow-md',
          'transition-[opacity,transform] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
          className,
        )}
        {...props}
      />
    </BaseTooltip.Positioner>
  </BaseTooltip.Portal>
));
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
