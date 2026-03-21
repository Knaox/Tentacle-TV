import { createPortal } from "react-dom";

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
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="animate-scale-in w-full max-w-sm rounded-xl p-6"
        style={{
          background: "rgba(15,15,25,0.97)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        }}
      >
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-white/50">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white/80"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 ring-1 ring-red-500/30 transition-colors hover:bg-red-500/30 disabled:opacity-50"
          >
            {isPending ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
