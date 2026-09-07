import * as React from 'react';
import { cn } from '@/lib/utils';

/** Keyboard hint. `tone="dark"` for use inside dark tooltips. Hidden on coarse pointers via .tl-kbd-hint. */
const Kbd = ({ className, tone = 'light', ...props }: React.HTMLAttributes<HTMLElement> & { tone?: 'light' | 'dark' }) => (
  <kbd
    className={cn(
      'tl-kbd-hint inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] px-1 font-mono text-[10px] font-medium',
      tone === 'dark' ? 'bg-white/15 text-white' : 'bg-[var(--hint)] text-[var(--text-2)]',
      className,
    )}
    {...props}
  />
);

export { Kbd };
