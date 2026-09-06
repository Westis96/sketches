import * as React from 'react';
import { Menu } from '@base-ui-components/react/menu';
import { cn } from '@/lib/utils';

/** Base UI menu with the shadcn dropdown-menu names. */
const DropdownMenu = Menu.Root;

function DropdownMenuTrigger({ asChild, children, ...props }: React.ComponentProps<typeof Menu.Trigger> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) return <Menu.Trigger render={children as React.ReactElement<Record<string, unknown>>} {...props} />;
  return <Menu.Trigger {...props}>{children}</Menu.Trigger>;
}

interface DropdownMenuContentProps extends React.ComponentProps<typeof Menu.Popup> {
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}
const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(({ side = 'bottom', align = 'start', sideOffset = 6, className, ...props }, ref) => (
  <Menu.Portal>
    <Menu.Positioner side={side} align={align} sideOffset={sideOffset} className="z-50 outline-none">
      <Menu.Popup
        ref={ref}
        className={cn(
          'ui-surface min-w-[12rem] rounded-[14px] p-1.5 text-[12.5px] text-[var(--text-1)] outline-none',
          'origin-[var(--transform-origin)] transition-[opacity,transform] ease-out data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100 duration-180 data-[ending-style]:duration-150',
          className,
        )}
        {...props}
      />
    </Menu.Positioner>
  </Menu.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

type DropdownMenuItemProps = Omit<React.ComponentPropsWithoutRef<typeof Menu.Item>, 'onClick'> & {
  /** shadcn-compatible name for the activation handler. */
  onSelect?: (event: React.MouseEvent<HTMLElement>) => void;
  inset?: boolean;
};
const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(({ className, onSelect, inset, ...props }, ref) => (
  <Menu.Item
    ref={ref}
    onClick={onSelect}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-[9px] px-2.5 py-2 outline-none',
      'data-[highlighted]:bg-[var(--accent-soft)] data-[highlighted]:text-[var(--text-1)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      inset && 'pl-8',
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuLabel = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-2.5 py-1.5 text-[12px] font-semibold', className)} {...props} />
);
const DropdownMenuSeparator = ({ className, ...props }: React.ComponentProps<typeof Menu.Separator>) => (
  <Menu.Separator className={cn('-mx-1 my-1 h-px bg-[var(--hint)]', className)} {...props} />
);
const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('ml-auto font-mono text-[10.5px] tracking-widest text-[var(--text-3)]', className)} {...props} />
);
const DropdownMenuGroup = Menu.Group;

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup };
