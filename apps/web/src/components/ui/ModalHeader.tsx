import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  return (
    <div
      className="flex items-start justify-between gap-4 px-6 pb-4 pt-5"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div className="min-w-0 flex-1">
        <h2
          id={titleId}
          className="truncate font-display text-heading-3 text-content-primary"
        >
          {title}
        </h2>
        {/* Un `div` et non un `p` : le sous-titre peut porter un avatar,
            qui est un bloc (le destinataire d'un message, par exemple). */}
        {subtitle && (
          <div className="mt-1 text-sm text-content-tertiary">{subtitle}</div>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common:close")}
          className="icon-btn -mr-2 -mt-1 h-9 w-9"
        >
          <XIcon className="h-5 w-5" aria-hidden />
        </button>
      )}
    </div>
  );
}
