import { useId } from "react";
import { Modal } from "./Modal";
import { GlassButton } from "./glass/GlassButton";

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
          {/* Verre natif : des capsules de verre, la confirmation porte la marque
              DANS le verre ; ailleurs, les boutons d'avant. */}
          <GlassButton
            onClick={onCancel}
            disabled={pending}
            appearance={{ level: "regular", shape: "capsule" }}
            className="inline-flex h-11 items-center justify-center px-5 text-sm font-semibold disabled:opacity-50"
            fallbackClassName="rounded-lg border border-line-subtle bg-fill-soft text-content-primary transition hover:bg-fill-medium"
          >
            {cancelLabel}
          </GlassButton>
          {danger ? (
            <button
              onClick={onConfirm}
              disabled={pending}
              className="lg-shape-capsule inline-flex h-11 items-center justify-center rounded-lg bg-[var(--status-error-bg)] border border-danger-border px-5 text-sm font-semibold text-[var(--status-error-fg)] transition hover:bg-danger-surface-hover disabled:opacity-50"
            >
              {confirmLabel}
            </button>
          ) : (
            <GlassButton
              onClick={onConfirm}
              disabled={pending}
              appearance={{ level: "prominent", tint: "brand", shape: "capsule" }}
              className="inline-flex h-11 items-center justify-center px-5 text-sm font-bold disabled:opacity-50"
              fallbackClassName="rounded-lg bg-cta-primary-bg text-cta-primary-fg transition hover:bg-cta-primary-bg-hover"
            >
              {confirmLabel}
            </GlassButton>
          )}
        </div>
      </div>
    </Modal>
  );
}
