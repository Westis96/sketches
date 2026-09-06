import * as React from 'react';
import { Dialog as BaseDialog } from '@base-ui-components/react/dialog';
import { cn } from '@/lib/utils';

/**
 * Base UI dialog with the shadcn names. Focus is trapped inside; the page is not
 * scroll-locked (the studio is a fixed-size shell, and locking would move the canvas).
 */
interface DialogProps extends Omit<React.ComponentProps<typeof BaseDialog.Root>, 'onOpenChange'> {
  /** `viaKeyboard` is true when the change came from the Escape key. */
  onOpenChange?: (open: boolean, viaKeyboard: boolean) => void;
}
const Dialog = ({ onOpenChange, modal = 'trap-focus', ...props }: DialogProps) => (
  <BaseDialog.Root modal={modal} onOpenChange={(o, details) => onOpenChange?.(o, details.reason === 'escape-key')} {...props} />
);

const DialogTrigger = BaseDialog.Trigger;
const DialogClose = BaseDialog.Close;

interface DialogContentProps extends React.ComponentProps<typeof BaseDialog.Popup> {
  /** Change state with no motion (the dialog was toggled from the keyboard). */
  instant?: boolean;
}
/** Centred modal: the one popup that scales from its own centre rather than a trigger. */
const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(({ className, instant, ...props }, ref) => (
  <BaseDialog.Portal>
    <BaseDialog.Backdrop
      data-instant={instant || undefined}
      className="fixed inset-0 z-40 bg-[rgba(28,24,18,0.28)] transition-opacity duration-250 ease-out data-[ending-style]:duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
    />
    <BaseDialog.Popup
      ref={ref}
      data-instant={instant || undefined}
      className={cn(
        'ui-surface fixed left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 rounded-[16px] text-[12px] text-[var(--text-1)] outline-none',
        'transition-[opacity,transform] duration-250 ease-out data-[ending-style]:duration-150',
        'data-[starting-style]:scale-[0.96] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.96] data-[ending-style]:opacity-0',
        'motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100',
        className,
      )}
      {...props}
    />
  </BaseDialog.Portal>
));
DialogContent.displayName = 'DialogContent';

const DialogTitle = ({ className, ...props }: React.ComponentProps<typeof BaseDialog.Title>) => (
  <BaseDialog.Title className={cn('text-[15px] font-semibold leading-tight text-[var(--text-1)]', className)} {...props} />
);
const DialogDescription = ({ className, ...props }: React.ComponentProps<typeof BaseDialog.Description>) => (
  <BaseDialog.Description className={cn('text-[12px] leading-snug text-[var(--text-2)]', className)} {...props} />
);

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription };
