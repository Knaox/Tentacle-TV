import { memo } from "react";
import { CheckIcon as Check } from "@phosphor-icons/react/dist/csr/Check";
import { LockIcon as Lock } from "@phosphor-icons/react/dist/csr/Lock";
import type { SelectMark } from "./useDeletionSelection";

/**
 * Le repère du mode sélection, posé dans le COIN haut-gauche de l'affiche —
 * jamais au centre de l'image (règle des cartes) ; le coin haut-droit garde la
 * pastille Ma liste · favori · vu. Décoratif : c'est la carte entière qui porte
 * le rôle `checkbox` et se coche au clic, au clavier, à Maj + clic.
 *
 * Posé SUR le média : fond noir translucide et liseré blanc constants dans les
 * deux thèmes. Pas de `backdrop-filter` : un rond de 28 px ne floute rien de
 * lisible, et chaque carte de la grille en paierait la passe.
 */
export const SelectionMark = memo(function SelectionMark({ mark }: { mark: SelectMark }) {
  if (mark === "locked") {
    return (
      <span
        aria-hidden
        className="pointer-events-none absolute left-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-pill bg-[rgba(var(--scrim-media-rgb),0.6)] text-on-media-secondary"
      >
        <Lock weight="bold" className="h-3.5 w-3.5" />
      </span>
    );
  }
  const checked = mark === "selected";
  return (
    <span
      aria-hidden
      // Cochée : l'aplat de la teinte franche et son encre (`--accent` / `--on-accent`), comme une
      // case du socle. Sinon un rond d'encre sur l'image, à liseré clair.
      className={`pointer-events-none absolute left-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-pill border transition-[background-color,border-color] duration-hover ${
        checked
          ? "border-transparent bg-accent text-accent-on shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
          : mark === "pending"
            ? "border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.3)]"
            : "border-on-media-secondary bg-[rgba(var(--scrim-media-rgb),0.45)] group-hover/card:border-on-media-primary"
      }`}
    >
      {checked && <Check weight="bold" className="h-4 w-4" />}
    </span>
  );
});

/** L'anneau d'une carte cochée — un calque qui épouse l'affiche, pas le bloc titre. */
export function SelectedRing() {
  return (
    <span
      aria-hidden
      /* Le ratio en CLASSE : `aspect-ratio` en style en ligne échappe à la passe
         qui le traduit pour les moteurs d'avant Chrome 88. */
      className="pointer-events-none absolute inset-x-0 top-0 z-10 aspect-[2/3] rounded-[var(--radius-lg)] ring-2 ring-accent"
    />
  );
}
