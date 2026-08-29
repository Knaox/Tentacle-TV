/**
 * Confirmation de suppression d'un téléchargement — familles danger-*,
 * animation CSS pure. La suppression retire le claim de CE compte ; le
 * fichier n'est réellement effacé du disque qu'au dernier claim (dédup).
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface DeleteDownloadModalProps {
  /** Ce qui va partir. Omis quand l'en-tête le dit déjà (suppression groupée). */
  title?: string;
  /** Remplace l'en-tête « Supprimer ce téléchargement ? ». */
  heading?: string;
  /** Remplace l'explication sous le titre. */
  message?: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteDownloadModal({
  title, heading, message, busy, onConfirm, onClose,
}: DeleteDownloadModalProps) {
  const { t } = useTranslation(["downloads", "common"]);
  const header = heading ?? t("downloads:deleteConfirmTitle");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label={header}
    >
      <div className="absolute inset-0" style={{ background: "var(--glass-backdrop)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-sm origin-center animate-scale-in overflow-hidden rounded-2xl border border-line-subtle"
        style={{
          background: "var(--surface-modal)",
          boxShadow: "var(--shadow-modal)",
          backdropFilter: "blur(var(--blur-modal))",
          WebkitBackdropFilter: "blur(var(--blur-modal))",
        }}
      >
        <div className="px-5 py-4">
          <h2 className="text-base font-bold text-content-primary">{header}</h2>
          {title && (
            <p className="mt-1 truncate text-sm font-semibold text-content-secondary">{title}</p>
          )}
          <p className="mt-2 text-xs leading-relaxed text-content-tertiary">
            {message ?? t("downloads:deleteConfirmMessage")}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-line-subtle px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-cta-ghost-bg px-4 py-2 text-sm font-semibold text-content-secondary transition-colors duration-150 hover:bg-cta-ghost-bg-hover"
          >
            {t("common:cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-md border border-danger-border bg-danger-surface px-4 py-2 text-sm font-bold text-status-error-fg transition-colors duration-150 hover:bg-danger-surface-hover disabled:opacity-50"
          >
            {t("downloads:deleteConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
