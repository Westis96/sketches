import * as React from 'react';
import { Slider as BaseSlider } from '@base-ui-components/react/slider';
import { cn } from '@/lib/utils';

interface SliderProps {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  onValueCommitted?: (value: number[]) => void;
  min?: number; max?: number; step?: number;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Base UI slider with the shadcn/Radix array-value API. */
const Slider = React.forwardRef<HTMLDivElement, SliderProps>(({ className, value, defaultValue, onValueChange, onValueCommitted, min = 0, max = 100, step = 1, disabled, ...props }, ref) => {
  const asArray = (v: number | readonly number[]) => (Array.isArray(v) ? [...v] : [v as number]);
  return (
    <BaseSlider.Root
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      min={min} max={max} step={step} disabled={disabled}
      onValueChange={(v) => onValueChange?.(asArray(v))}
      onValueCommitted={(v) => onValueCommitted?.(asArray(v))}
      className={cn('relative flex w-full touch-none select-none items-center py-1.5', className)}
      {...props}
    >
      <BaseSlider.Control className="flex h-5 w-full items-center coarse:h-8">
        <BaseSlider.Track className="relative h-1.5 w-full grow overflow-visible rounded-full bg-[var(--hint-strong)]">
          <BaseSlider.Indicator className="absolute h-full rounded-full bg-[var(--accent)]" />
          <BaseSlider.Thumb className="block h-[18px] w-[18px] rounded-full border coarse:h-6 coarse:w-6 border-black/10 bg-white shadow-[0_1px_3px_rgba(28,24,18,0.25)] outline-none transition-transform duration-150 ease-out data-[dragging]:scale-110 motion-reduce:data-[dragging]:scale-100 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40" />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
});
Slider.displayName = 'Slider';

export { Slider };
