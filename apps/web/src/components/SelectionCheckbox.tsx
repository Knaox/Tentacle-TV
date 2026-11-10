import { memo } from "react";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";

interface SelectionCheckboxProps {
  checked: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export const SelectionCheckbox = memo(function SelectionCheckbox({ checked, onClick }: SelectionCheckboxProps) {
  // Pastille d'angle posée SUR l'affiche : un voile d'encre et un liseré `on-media`, constants
  // dans les deux thèmes. Cochée, l'aplat de la teinte franche (un état ACTIF). Plus de
  // `backdrop-filter` : une passe de flou par carte, sur toute une grille en sélection.
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className={`absolute left-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-press ${
        checked
          ? "bg-accent text-accent-on"
          : "border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.55)] text-transparent"
      }`}
    >
      {checked && <CheckIcon size={14} weight="bold" aria-hidden />}
    </button>
  );
});
