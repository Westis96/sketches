import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold leading-4 whitespace-nowrap', {
  variants: {
    variant: {
      default: 'bg-[var(--ink)] text-[var(--ink-fg)]',
      accent: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
      secondary: 'bg-[var(--low)] text-[var(--text-2)]',
      outline: 'ring-1 ring-inset ring-[var(--hint-strong)] text-[var(--text-2)]',
      success: 'bg-[var(--success)] text-white',
      warning: 'bg-[var(--warning)] text-white',
      danger: 'bg-[var(--danger)] text-white',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
