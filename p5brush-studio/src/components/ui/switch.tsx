import * as React from 'react';
import { Switch as BaseSwitch } from '@base-ui-components/react/switch';
import { cn } from '@/lib/utils';

interface SwitchProps extends Omit<React.ComponentProps<typeof BaseSwitch.Root>, 'onCheckedChange'> {
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(({ className, onCheckedChange, ...props }, ref) => (
  <BaseSwitch.Root
    ref={ref}
    onCheckedChange={(checked) => onCheckedChange?.(checked)}
    className={cn(
      'group inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full p-[2px] outline-none transition-colors',
      'bg-[var(--hint-strong)] data-[checked]:bg-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <BaseSwitch.Thumb className="block h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(28,24,18,0.3)] transition-transform data-[checked]:translate-x-4" />
  </BaseSwitch.Root>
));
Switch.displayName = 'Switch';

export { Switch };
