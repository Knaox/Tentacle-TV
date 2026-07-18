import { useId } from "react";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Style danger (rouge) pour les actions destructives. */
  danger?: boolean;
  /** Désactive les boutons pendant l'action. */
  pending?: boolean;
}

/**
 * Dialogue de confirmation maison sur le primitive Modal.
 * À utiliser à la place de window.confirm() : les WKWebView de Tauri (macOS)
 * n'implémentent pas les dialogues natifs alert/confirm/prompt — confirm()
 * y retourne false sans rien afficher (wry #460).
 */
export function ConfirmDialog({
  open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, danger, pending,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();

  return (
    <Modal open={open} onClose={onCancel} maxWidth={420} labelledBy={titleId} describedBy={descId}>
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">{title}</h2>
        <p id={descId} className="mt-2 text-sm leading-relaxed text-content-tertiary">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-line-subtle bg-fill-soft px-5 text-sm font-semibold text-content-primary transition hover:bg-fill-medium disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className={
              danger
                ? "inline-flex h-11 items-center justify-center rounded-lg bg-[var(--status-error-bg)] border border-[var(--status-error)]/30 px-5 text-sm font-semibold text-[var(--status-error-fg)] transition hover:bg-[var(--status-error)]/25 disabled:opacity-50"
                : "inline-flex h-11 items-center justify-center rounded-lg bg-cta-primary-bg px-5 text-sm font-bold text-cta-primary-fg transition hover:bg-cta-primary-bg-hover disabled:opacity-50"
            }
            style={danger ? undefined : { boxShadow: "0 8px 22px rgba(var(--brand-rgb), 0.45)" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
