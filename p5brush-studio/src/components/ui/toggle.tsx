import * as React from 'react';
import { Toggle as BaseToggle } from '@base-ui-components/react/toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const toggleVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-[8px] text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'text-[var(--text-2)] hover:bg-[var(--low)] hover:text-[var(--text-1)] data-[pressed]:bg-[var(--accent-soft)] data-[pressed]:text-[var(--accent-strong)]',
        quiet: 'text-[var(--text-2)] hover:bg-[var(--low)] hover:text-[var(--text-1)] data-[pressed]:bg-[var(--hint-strong)] data-[pressed]:text-[var(--text-1)]',
        outline: 'border border-[var(--hint-strong)] bg-transparent hover:bg-[var(--low)] data-[pressed]:border-[var(--accent)] data-[pressed]:text-[var(--accent-strong)]',
      },
      size: {
        default: 'h-8 min-w-8 px-2',
        sm: 'h-7 min-w-7 px-1.5 text-[11px]',
        lg: 'h-9 min-w-9 px-2.5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

interface ToggleProps extends Omit<React.ComponentProps<typeof BaseToggle>, 'onPressedChange'>, VariantProps<typeof toggleVariants> {
  onPressedChange?: (pressed: boolean) => void;
}
const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(({ className, variant, size, onPressedChange, ...props }, ref) => (
  <BaseToggle ref={ref} onPressedChange={(p) => onPressedChange?.(p)} className={cn(toggleVariants({ variant, size }), className)} {...props} />
));
Toggle.displayName = 'Toggle';

export { Toggle, toggleVariants };
