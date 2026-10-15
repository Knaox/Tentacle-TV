/** Les boutons des dialogues de suppression — mêmes gabarits que `ui/ConfirmDialog`. */
const DIALOG_BUTTON =
  "inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] disabled:opacity-50";

export const DIALOG_CANCEL = `${DIALOG_BUTTON} border border-line-subtle bg-fill-soft text-content-primary hover:bg-fill-medium`;
export const DIALOG_DANGER = `${DIALOG_BUTTON} border border-danger-border bg-[var(--status-error-bg)] text-[var(--status-error-fg)] hover:bg-danger-surface-hover`;
