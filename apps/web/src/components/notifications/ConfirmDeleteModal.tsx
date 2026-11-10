import { Modal } from "../ui/Modal";

interface ConfirmDeleteModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  isPending: boolean;
}

export function ConfirmDeleteModal({
  open, onConfirm, onCancel, title, message, confirmLabel, cancelLabel, isPending,
}: ConfirmDeleteModalProps) {
  return (
    <Modal open={open} onClose={onCancel} maxWidth={400} labelledBy="confirm-delete-title">
      {/* Ouverte depuis le panneau des notifications : un clic ici ne le referme pas. */}
      <div className="p-6" data-floating-keep>
        <h3 id="confirm-delete-title" className="text-base font-semibold text-content-primary">
          {title}
        </h3>
        <p className="mt-2 text-sm text-content-tertiary">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="btn btn-ghost"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="btn btn-danger"
          >
            {isPending ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
