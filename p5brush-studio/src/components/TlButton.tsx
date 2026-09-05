import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface TlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  kbd?: string;
  active?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

/** tldraw-style 40px icon button with a dark tooltip and a keyboard hint. */
export const TlButton = forwardRef<HTMLButtonElement, TlButtonProps>(function TlButton(
  { label, kbd, active, side = 'top', className, children, ...props }, ref,
) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button ref={ref} type="button" aria-label={label} data-active={active ? 'true' : undefined} className={cn('tl-btn', className)} {...props}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={8} className="rounded-[7px] border-0 bg-[#1f1f1f] px-2.5 py-1.5 text-[12px] font-medium text-white shadow-lg">
        <span className="inline-flex items-center">{label}{kbd && <kbd className="tl-kbd">{kbd}</kbd>}</span>
      </TooltipContent>
    </Tooltip>
  );
});

/** Small helper for tooltips on arbitrary triggers. */
export function TlTip({ label, kbd, side = 'top', children }: { label: string; kbd?: string; side?: 'top' | 'bottom' | 'left' | 'right'; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={8} className="rounded-[7px] border-0 bg-[#1f1f1f] px-2.5 py-1.5 text-[12px] font-medium text-white shadow-lg">
        <span className="inline-flex items-center">{label}{kbd && <kbd className="tl-kbd">{kbd}</kbd>}</span>
      </TooltipContent>
    </Tooltip>
  );
}
