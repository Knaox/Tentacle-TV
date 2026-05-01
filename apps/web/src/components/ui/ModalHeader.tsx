import type { ReactNode } from "react";

interface ModalHeaderProps {
  title: string;
  subtitle?: ReactNode;
  onClose?: () => void;
  /** Optional id forwarded as the title element id (used by Modal aria-labelledby). */
  titleId?: string;
}

/**
 * Header band shared across all Modal-based dialogs.
 * Provides title + optional subtitle + close button (top-right).
 */
export function ModalHeader({ title, subtitle, onClose, titleId }: ModalHeaderProps) {
  return (
    <div
      className="flex items-start justify-between gap-4 px-6 pb-4 pt-5"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div className="min-w-0 flex-1">
        <h2
          id={titleId}
          className="truncate text-lg font-semibold tracking-tight text-white"
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-white/55">{subtitle}</p>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="-mr-2 -mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
