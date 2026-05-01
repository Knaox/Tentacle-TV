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
      <div className="p-6">
        <h3 id="confirm-delete-title" className="text-base font-semibold text-white">
          {title}
        </h3>
        <p className="mt-2 text-sm text-white/55">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm text-white/65 transition-colors hover:bg-white/10 hover:text-white/90"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150 hover:scale-[1.03] disabled:opacity-50"
            style={{
              background: "var(--status-error-bg)",
              color: "var(--status-error-fg)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
            }}
          >
            {isPending ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
