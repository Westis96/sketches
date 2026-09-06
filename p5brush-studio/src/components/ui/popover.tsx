import * as React from 'react';
import { Popover as BasePopover } from '@base-ui-components/react/popover';
import { cn } from '@/lib/utils';

const Popover = BasePopover.Root;

function PopoverTrigger({ asChild, children, ...props }: React.ComponentProps<typeof BasePopover.Trigger> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) return <BasePopover.Trigger render={children as React.ReactElement<Record<string, unknown>>} {...props} />;
  return <BasePopover.Trigger {...props}>{children}</BasePopover.Trigger>;
}

interface PopoverContentProps extends React.ComponentProps<typeof BasePopover.Popup> {
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}
const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(({ side = 'bottom', align = 'center', sideOffset = 6, className, ...props }, ref) => (
  <BasePopover.Portal>
    <BasePopover.Positioner side={side} align={align} sideOffset={sideOffset} className="z-50 outline-none">
      <BasePopover.Popup
        ref={ref}
        className={cn(
          'ui-surface w-72 rounded-[14px] p-3 text-[12px] text-[var(--text-1)] outline-none',
          'origin-[var(--transform-origin)] transition-[opacity,transform] ease-out data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100 duration-200 data-[ending-style]:duration-150',
          className,
        )}
        {...props}
      />
    </BasePopover.Positioner>
  </BasePopover.Portal>
));
PopoverContent.displayName = 'PopoverContent';

export { Popover, PopoverTrigger, PopoverContent };
