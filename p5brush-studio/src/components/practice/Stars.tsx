import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Three stars, `n` of them filled. `animate` pops them in with a short stagger (rare-tier delight). */
export function Stars({ n, size = 'h-3.5 w-3.5', animate = false, className }: { n: number; size?: string; animate?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          className={cn(size, i < n ? 'fill-[var(--warning)] text-[var(--warning)]' : 'text-[var(--hint-strong)]', animate && i < n && 'star-pop')}
          style={animate ? { animationDelay: `${120 + i * 70}ms` } : undefined}
        />
      ))}
    </span>
  );
}
