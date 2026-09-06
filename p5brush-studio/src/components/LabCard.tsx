import { ChevronDown, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { usePersistedState } from '@/hooks/usePersistedState';

/** A collapsible lab card: icon, title, an optional status badge, and a body that remembers whether it was open. */
export function LabCard({ id, icon: Icon, title, badge, defaultOpen = true, testId, children }: {
  id: string; icon: LucideIcon; title: string; badge?: string | null; defaultOpen?: boolean; testId?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = usePersistedState(`p5brush-studio:lab:${id}`, defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="pointer-events-auto w-[min(300px,calc(100vw-16px))] text-[12px]" data-testid={testId}>
        <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-[16px] px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40">
          <Icon className="h-4 w-4 text-[var(--accent-strong)]" />
          <span className="flex-1 text-[13px] font-semibold text-[var(--text-1)]">{title}</span>
          {badge && <Badge variant="accent">{badge}</Badge>}
          <ChevronDown className="h-4 w-4 text-[var(--text-3)] transition-transform group-data-[panel-open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 border-t border-[var(--hint)] px-3 pb-3 pt-2.5">{children}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
