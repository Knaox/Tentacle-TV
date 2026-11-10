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
        <h2 id={titleId} className="font-display text-heading-3 text-content-primary">{title}</h2>
        <p id={descId} className="mt-2 text-sm leading-relaxed text-content-tertiary">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          {/* Verre natif : la peau peinte des boutons d'une feuille, jamais une
              lentille dans la plaque (lot lg7) ; la confirmation porte la marque
              DANS le verre. Ailleurs, les boutons d'avant. */}
          <GlassButton
            inSurface
            onClick={onCancel}
            disabled={pending}
            appearance={{ level: "regular", shape: "capsule" }}
            className="inline-flex h-11 items-center justify-center px-5 text-sm font-semibold disabled:opacity-50"
            fallbackClassName="btn btn-soft"
          >
            {cancelLabel}
          </GlassButton>
          {danger ? (
            <GlassButton
              inSurface
              danger
              onClick={onConfirm}
              disabled={pending}
              appearance={{ level: "regular", shape: "capsule" }}
              className="inline-flex h-11 items-center justify-center px-5 text-sm font-semibold disabled:opacity-50"
              fallbackClassName="lg-shape-capsule btn btn-danger"
            >
              {confirmLabel}
            </GlassButton>
          ) : (
            <GlassButton
              inSurface
              onClick={onConfirm}
              disabled={pending}
              appearance={{ level: "prominent", tint: "brand", shape: "capsule" }}
              className="inline-flex h-11 items-center justify-center px-5 text-sm font-bold disabled:opacity-50"
              fallbackClassName="btn btn-solid"
            >
              {confirmLabel}
            </GlassButton>
          )}
        </div>
      </div>
    </Modal>
  );
}
