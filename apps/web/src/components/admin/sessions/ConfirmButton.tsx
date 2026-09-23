import { useState, type ReactNode } from "react";
import { cls } from "../../../pages/adminUtils";

/**
 * Une action destructive en deux temps, sur place : le bouton devient une
 * question, « Annuler » a le focus — un réflexe de clic ou d'Entrée n'arrête
 * rien. Pas de fenêtre modale : la carte reste sous les yeux pendant qu'on
 * confirme.
 */
export function ConfirmButton({
  label,
  icon,
  prompt,
  confirmLabel,
  cancelLabel,
  pending,
  onConfirm,
}: {
  label: string;
  icon?: ReactNode;
  prompt: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" className={`${cls.bd} px-4`} disabled={pending} onClick={() => setAsking(true)}>
        {icon}
        {label}
      </button>
    );
  }

  return (
    <div role="group" aria-label={prompt} className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-content-secondary">{prompt}</span>
      {/* Le refus a le focus : un réflexe d'Entrée n'arrête rien. */}
      <button type="button" autoFocus className={`${cls.bs} px-4`} onClick={() => setAsking(false)}>
        {cancelLabel}
      </button>
      <button
        type="button"
        className={`${cls.bd} px-4`}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
