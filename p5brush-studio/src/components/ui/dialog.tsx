import * as React from 'react';
import { Dialog as BaseDialog } from '@base-ui-components/react/dialog';
import { useMediaQuery, PHONE_QUERY } from '@/hooks/useMediaQuery';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { cn } from '@/lib/utils';

/**
 * Base UI dialog with the shadcn names. Focus is trapped inside; the page is not
 * scroll-locked (the studio is a fixed-size shell, and locking would move the canvas).
 * On phones the same dialog is a bottom sheet: full width, slides up, drags down to close.
 */
interface DialogProps extends Omit<React.ComponentProps<typeof BaseDialog.Root>, 'onOpenChange'> {
  /** `viaKeyboard` is true when the change came from the Escape key. */
  onOpenChange?: (open: boolean, viaKeyboard: boolean) => void;
}
const DialogOpenChange = React.createContext<((open: boolean) => void) | null>(null);
const Dialog = ({ onOpenChange, modal = 'trap-focus', ...props }: DialogProps) => {
  const close = React.useCallback((o: boolean) => onOpenChange?.(o, false), [onOpenChange]);
  return (
    <DialogOpenChange.Provider value={close}>
      <BaseDialog.Root modal={modal} onOpenChange={(o, details) => onOpenChange?.(o, details.reason === 'escape-key')} {...props} />
    </DialogOpenChange.Provider>
  );
};

const DialogTrigger = BaseDialog.Trigger;
const DialogClose = BaseDialog.Close;

interface DialogContentProps extends React.ComponentProps<typeof BaseDialog.Popup> {
  /** Change state with no motion (the dialog was toggled from the keyboard). */
  instant?: boolean;
}
/** Centred modal on tablets and up (scales from its own centre); a bottom sheet on phones. */
const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(({ className, instant, children, ...props }, ref) => {
  const phone = useMediaQuery(PHONE_QUERY);
  const setOpen = React.useContext(DialogOpenChange);
  const { sheetRef, handleProps } = useSheetDrag(() => setOpen?.(false), phone);
  const mergedRef = React.useCallback((el: HTMLDivElement | null) => {
    sheetRef.current = el;
    if (typeof ref === 'function') ref(el); else if (ref) ref.current = el;
  }, [ref, sheetRef]);
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop
        data-instant={instant || undefined}
        className="fixed inset-0 z-40 bg-[rgba(28,24,18,0.28)] transition-opacity duration-250 ease-out data-[ending-style]:duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
      />
      <BaseDialog.Popup
        ref={mergedRef}
        data-instant={instant || undefined}
        className={cn(
          'ui-surface fixed left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 rounded-[16px] text-[12px] text-[var(--text-1)] outline-none',
          'transition-[opacity,transform] duration-250 ease-out data-[ending-style]:duration-150',
          'data-[starting-style]:scale-[0.96] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.96] data-[ending-style]:opacity-0',
          'motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100',
          // Phone: a sheet pinned to the bottom edge, drawer curve, no fade or scale.
          'max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[20px]',
          'max-sm:transition-transform max-sm:duration-400 max-sm:ease-drawer max-sm:data-[ending-style]:duration-250',
          'max-sm:data-[starting-style]:translate-y-full max-sm:data-[starting-style]:scale-100 max-sm:data-[starting-style]:opacity-100',
          'max-sm:data-[ending-style]:translate-y-full max-sm:data-[ending-style]:scale-100 max-sm:data-[ending-style]:opacity-100',
          'max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]',
          className,
        )}
        {...props}
      >
        {phone && (
          <div className="-mx-4 -mt-4 mb-1 cursor-grab touch-none px-4 pb-2 pt-2.5 active:cursor-grabbing" aria-hidden {...handleProps}>
            <div className="sheet-grip" />
          </div>
        )}
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
});
DialogContent.displayName = 'DialogContent';

const DialogTitle = ({ className, ...props }: React.ComponentProps<typeof BaseDialog.Title>) => (
  <BaseDialog.Title className={cn('text-[15px] font-semibold leading-tight text-[var(--text-1)]', className)} {...props} />
);
const DialogDescription = ({ className, ...props }: React.ComponentProps<typeof BaseDialog.Description>) => (
  <BaseDialog.Description className={cn('text-[12px] leading-snug text-[var(--text-2)]', className)} {...props} />
);

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription };
