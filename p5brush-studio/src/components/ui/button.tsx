import * as React from 'react';
import { useRender } from '@base-ui-components/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] text-[12px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'press bg-[var(--accent)] text-white shadow-[var(--shadow-sm)] hover:bg-[var(--accent-strong)]',
        /** The Duolingo button: solid face on a darker bottom edge that presses flat; colour from --lvl. */
        duo: 'duo-btn duo-primary h-11 px-5 text-[13px]',
        'duo-secondary': 'duo-btn duo-secondary h-11 px-5 text-[13px]',
        secondary: 'press bg-[var(--accent-soft)] text-[var(--accent-strong)] hover:bg-[var(--accent-soft-strong)]',
        outline: 'press ring-1 ring-inset ring-[var(--hint-strong)] bg-transparent text-[var(--text-1)] hover:bg-[var(--low)]',
        ghost: 'press text-[var(--text-2)] hover:bg-[var(--low)] hover:text-[var(--text-1)] data-[active=true]:bg-[var(--hint-strong)] data-[active=true]:text-[var(--text-1)]',
        /** Toolbar unit: 40px icon button, accent when active. */
        tool: 'press h-10 w-10 rounded-[10px] text-[var(--text-1)] hover:bg-[var(--low)] active:bg-[var(--hint-strong)] data-[active=true]:bg-[var(--accent)] data-[active=true]:text-white data-[active=true]:hover:bg-[var(--accent-strong)] data-[popup-open]:bg-[var(--low)] [&_svg]:size-[18px] [&_svg]:stroke-[1.75]',
        ink: 'press bg-[var(--ink)] text-[var(--ink-fg)] hover:bg-[var(--ink-strong)]',
        link: 'press h-auto rounded-none px-0 text-[var(--accent-strong)] underline-offset-4 hover:underline',
        danger: 'press bg-[var(--danger)] text-white hover:brightness-95',
      },
      size: {
        default: 'h-9 px-3.5 [&_svg]:size-4',
        sm: 'h-8 px-2.5 text-[11.5px] [&_svg]:size-3.5 coarse:h-9',
        xs: 'h-6 rounded-[7px] px-1.5 text-[10.5px] [&_svg]:size-3',
        lg: 'h-10 px-4 text-[13px] [&_svg]:size-4',
        icon: 'h-8 w-8 [&_svg]:size-4 coarse:h-9 coarse:w-9',
        'icon-sm': 'h-7 w-7 [&_svg]:size-3.5 coarse:h-8 coarse:w-8',
        'icon-xs': 'h-6 w-6 [&_svg]:size-3',
        none: '',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render another element (a link, a Base UI trigger) with the button's styles. */
  render?: useRender.RenderProp;
  active?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, render, active, type = 'button', ...props }, ref) => {
  const element = useRender({
    render: render ?? <button type={type} />,
    ref,
    props: { ...props, 'data-active': active ? 'true' : undefined, className: cn(buttonVariants({ variant, size: variant === 'tool' && !size ? 'none' : size }), className) },
  });
  return element;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
