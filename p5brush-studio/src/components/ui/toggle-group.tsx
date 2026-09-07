import * as React from 'react';
import { ToggleGroup as BaseToggleGroup } from '@base-ui-components/react/toggle-group';
import { Toggle as BaseToggle } from '@base-ui-components/react/toggle';
import { type VariantProps } from 'class-variance-authority';
import { toggleVariants } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

type Variant = VariantProps<typeof toggleVariants>;
const ToggleGroupContext = React.createContext<Variant>({ variant: 'default', size: 'default' });

type SingleProps = { type: 'single'; value?: string; defaultValue?: string; onValueChange?: (value: string) => void };
type MultipleProps = { type: 'multiple'; value?: string[]; defaultValue?: string[]; onValueChange?: (value: string[]) => void };
type ToggleGroupProps = (SingleProps | MultipleProps) & Variant & { className?: string; disabled?: boolean; 'aria-label'?: string; children: React.ReactNode; orientation?: 'horizontal' | 'vertical' };

/** Base UI toggle group with the Radix/shadcn `type="single" | "multiple"` API (empty string = nothing pressed). */
const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(({ className, variant, size, children, type, value, defaultValue, onValueChange, ...props }, ref) => {
  const toArray = (v: string | string[] | undefined) => (v === undefined ? undefined : Array.isArray(v) ? v : v === '' ? [] : [v]);
  return (
    <BaseToggleGroup
      ref={ref}
      multiple={type === 'multiple'}
      value={toArray(value)}
      defaultValue={toArray(defaultValue)}
      onValueChange={(group) => {
        if (type === 'multiple') (onValueChange as MultipleProps['onValueChange'])?.(group as string[]);
        else (onValueChange as SingleProps['onValueChange'])?.((group[0] as string) ?? '');
      }}
      className={cn('flex items-center gap-1', className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
    </BaseToggleGroup>
  );
});
ToggleGroup.displayName = 'ToggleGroup';

interface ToggleGroupItemProps extends React.ComponentProps<typeof BaseToggle>, Variant { value: string }
const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(({ className, children, variant, size, ...props }, ref) => {
  const ctx = React.useContext(ToggleGroupContext);
  return (
    <BaseToggle ref={ref} className={cn(toggleVariants({ variant: ctx.variant ?? variant, size: ctx.size ?? size }), className)} {...props}>
      {children}
    </BaseToggle>
  );
});
ToggleGroupItem.displayName = 'ToggleGroupItem';

export { ToggleGroup, ToggleGroupItem };
