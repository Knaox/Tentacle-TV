import type { ReactNode } from "react";

/** Un léger retour haptique, là où le navigateur en a un. */
export function sheetHaptic() {
  try {
    navigator.vibrate?.(10);
  } catch {
    /* pas de vibreur */
  }
}

/** La teinte d'une cellule active, et ses composantes RVB pour les voiles de l'anneau. */
export interface ActionCellTone {
  color: string;
  rgb: string;
}

/**
 * La cellule ronde des feuilles d'appui long (`ActionCell` de l'app) :
 * anneau 60, glyphe 26 (l'enfant, qui prend `currentColor`), libellé 12,5
 * qui dit ce que fera le geste. Active : l'anneau et le libellé prennent la
 * teinte de l'état — la forme du glyphe le dit aussi, sans la couleur.
 * Partagée par la feuille des titres de la bibliothèque et par celle des
 * titres hors bibliothèque (`ExternalActionSheet`).
 */
export function ActionCell({ label, active, tone, toggle = true, onPress, children }: {
  label: string;
  active: boolean;
  tone: ActionCellTone;
  /** Faux : une action, pas une bascule — pas d'`aria-pressed`. */
  toggle?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        sheetHaptic();
        onPress();
      }}
      aria-pressed={toggle ? active : undefined}
      className="flex min-w-0 flex-1 flex-col items-center rounded-xl bg-fill-faint px-1.5 py-4 transition-opacity duration-150 active:opacity-75"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <span
        className="mb-2.5 flex h-[60px] w-[60px] items-center justify-center rounded-full border"
        style={{
          background: active ? `rgba(${tone.rgb}, 0.13)` : "var(--fill-subtle)",
          borderColor: active ? `rgba(${tone.rgb}, 0.4)` : "var(--border-subtle)",
          color: active ? tone.color : "var(--text-primary)",
        }}
      >
        {children}
      </span>
      <span
        className="text-center text-[12.5px] font-semibold leading-[15px] tracking-[0.1px]"
        style={{ color: active ? tone.color : "var(--text-secondary)" }}
      >
        {label}
      </span>
    </button>
  );
}
