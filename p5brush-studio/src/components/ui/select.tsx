import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Select as BaseSelect } from '@base-ui-components/react/select';
import { cn } from '@/lib/utils';

/** Base UI select with the shadcn names; single-value, string items. */
interface SelectProps { value?: string; defaultValue?: string; onValueChange?: (value: string) => void; disabled?: boolean; children: React.ReactNode; name?: string }
function Select({ value, defaultValue, onValueChange, disabled, children }: SelectProps) {
  return (
    <BaseSelect.Root value={value} defaultValue={defaultValue} disabled={disabled} onValueChange={(v) => { if (v !== null && v !== undefined) onValueChange?.(String(v)); }}>
      {children}
    </BaseSelect.Root>
  );
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof BaseSelect.Trigger>>(({ className, children, ...props }, ref) => (
  <BaseSelect.Trigger
    ref={ref}
    className={cn(
      'press flex h-8 w-full items-center justify-between gap-2 rounded-[9px] bg-[var(--low)] px-2.5 text-[12px] text-[var(--text-1)] outline-none',
      'hover:bg-[var(--hint)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 data-[popup-open]:bg-[var(--hint)] disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {children}
    <BaseSelect.Icon className="flex shrink-0"><ChevronsUpDown className="h-3.5 w-3.5 text-[var(--text-3)]" /></BaseSelect.Icon>
  </BaseSelect.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

const SelectValue = ({ placeholder, className }: { placeholder?: string; className?: string }) => (
  <BaseSelect.Value className={cn('truncate', className)}>{(v: unknown) => (v == null || v === '' ? <span className="text-[var(--text-3)]">{placeholder}</span> : String(v))}</BaseSelect.Value>
);

const SelectContent = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof BaseSelect.Popup> & { sideOffset?: number }>(({ className, sideOffset = 4, children, ...props }, ref) => (
  <BaseSelect.Portal>
    <BaseSelect.Positioner sideOffset={sideOffset} className="z-50 outline-none">
      <BaseSelect.Popup
        ref={ref}
        className={cn(
          'ui-surface min-w-[var(--anchor-width)] rounded-[12px] p-1 text-[12px] text-[var(--text-1)] outline-none',
          'origin-[var(--transform-origin)] transition-[opacity,transform] ease-out data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100 duration-180 data-[ending-style]:duration-150',
          className,
        )}
        {...props}
      >
        <BaseSelect.List>{children}</BaseSelect.List>
      </BaseSelect.Popup>
    </BaseSelect.Positioner>
  </BaseSelect.Portal>
));
SelectContent.displayName = 'SelectContent';

const SelectItem = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof BaseSelect.Item>>(({ className, children, ...props }, ref) => (
  <BaseSelect.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-[8px] py-1.5 pl-2 pr-7 outline-none',
      'data-[highlighted]:bg-[var(--accent-soft)] data-[selected]:font-medium data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <BaseSelect.ItemText className="truncate">{children}</BaseSelect.ItemText>
    <BaseSelect.ItemIndicator className="absolute right-2 flex"><Check className="h-3.5 w-3.5 text-[var(--accent)]" /></BaseSelect.ItemIndicator>
  </BaseSelect.Item>
));
SelectItem.displayName = 'SelectItem';

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
