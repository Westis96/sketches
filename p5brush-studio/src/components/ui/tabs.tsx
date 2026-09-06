import * as React from 'react';
import { Tabs as BaseTabs } from '@base-ui-components/react/tabs';
import { cn } from '@/lib/utils';

interface TabsProps extends Omit<React.ComponentProps<typeof BaseTabs.Root>, 'onValueChange' | 'value' | 'defaultValue'> {
  value?: string; defaultValue?: string;
  onValueChange?: (value: string) => void;
}
const Tabs = ({ onValueChange, ...props }: TabsProps) => <BaseTabs.Root onValueChange={(v) => onValueChange?.(String(v))} {...props} />;

const TabsList = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof BaseTabs.List>>(({ className, children, ...props }, ref) => (
  <BaseTabs.List ref={ref} className={cn('relative z-0 inline-flex items-center justify-center rounded-[10px] bg-[var(--low)] p-0.5 text-[var(--text-2)]', className)} {...props}>
    {children}
    <BaseTabs.Indicator className="absolute left-0 top-1/2 z-[-1] h-[calc(100%-4px)] w-[var(--active-tab-width)] -translate-y-1/2 translate-x-[var(--active-tab-left)] rounded-[8px] bg-[var(--surface)] shadow-[var(--shadow-sm)] transition-[translate,width] duration-200 ease-out" />
  </BaseTabs.List>
));
TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof BaseTabs.Tab>>(({ className, ...props }, ref) => (
  <BaseTabs.Tab
    ref={ref}
    className={cn(
      'inline-flex h-7 flex-1 items-center justify-center whitespace-nowrap rounded-[8px] px-2 text-[12px] font-medium outline-none transition-colors',
      'text-[var(--text-2)] hover:text-[var(--text-1)] data-[active]:text-[var(--text-1)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof BaseTabs.Panel>>(({ className, ...props }, ref) => (
  <BaseTabs.Panel ref={ref} className={cn('outline-none', className)} {...props} />
));
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
