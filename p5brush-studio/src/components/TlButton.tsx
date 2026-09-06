import { forwardRef, type ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface TlButtonProps extends Omit<ButtonProps, 'variant' | 'size'> {
  label: string;
  kbd?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

/** Toolbar unit: a 40px icon button with a dark tooltip and a keyboard hint. */
export const TlButton = forwardRef<HTMLButtonElement, TlButtonProps>(function TlButton({ label, kbd, side = 'top', children, ...props }, ref) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button ref={ref} variant="tool" aria-label={label} {...props}>{children}</Button>} />
      <TooltipContent side={side} sideOffset={8}>
        <span className="inline-flex items-center gap-2">{label}{kbd && <Kbd tone="dark">{kbd}</Kbd>}</span>
      </TooltipContent>
    </Tooltip>
  );
});

/** Tooltip on an arbitrary trigger. */
export function TlTip({ label, kbd, side = 'top', children }: { label: string; kbd?: string; side?: 'top' | 'bottom' | 'left' | 'right'; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={8}>
        <span className="inline-flex items-center gap-2">{label}{kbd && <Kbd tone="dark">{kbd}</Kbd>}</span>
      </TooltipContent>
    </Tooltip>
  );
}
