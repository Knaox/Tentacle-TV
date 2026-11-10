import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { FloatingLayer } from "../floating/FloatingLayer";
import { chipCls } from "./filterChip";

interface FilterMenuProps {
  label: string;
  /** Résumé de la sélection — remplace le libellé quand un filtre est posé. */
  value?: string | null;
  /** Efface ce filtre depuis la pastille, sans ouvrir le menu. */
  onClear?: () => void;
  /** Largeur du panneau. Les listes longues en demandent davantage. */
  width?: number;
  /**
   * Un en-tête — le critère et une croix — en tête du panneau. Éteint sur le
   * bureau, où un clic à côté referme le menu ; allumé par le téléviseur LG,
   * où il n'y a pas de « à côté » et où la croix est la sortie visible, comme
   * sur ses panneaux et sur les téléviseurs natifs.
   */
  closeButton?: boolean;
  /** Icône posée avant le libellé (tri, par exemple). */
  icon?: ReactNode;
  /**
   * Garder l'allure de repos même quand une valeur est posée. Le tri en a
   * toujours une : teinté en permanence, il se lisait comme un filtre actif.
   */
  neutral?: boolean;
  /** Ancrer le panneau sur le bord droit du déclencheur (menus en fin de barre). */
  align?: "left" | "right";
  children: ReactNode;
}

/**
 * Filtre en menu ancré : une pastille qui ouvre un petit panneau juste
 * dessous, la grille restant visible derrière.
 *
 * Remplace le grand panneau latéral, qui recouvrait tout l'écran pour poser un
 * genre : on filtrait à l'aveugle, sans jamais voir l'effet sur les résultats
 * avant d'avoir refermé le panneau.
 */
export function FilterMenu({
  label, value, onClear, width = 260, closeButton = false, icon, neutral = false, align = "left", children,
}: FilterMenuProps) {
  const { t } = useTranslation(["common", "library"]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const active = Boolean(value) && !neutral;

  // La croix rend le focus à la pastille : sans cela, il disparaissait avec
  // le panneau démonté.
  const closeFromPanel = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        // La pilule du socle, la même que les pastilles voisines (`chipCls`) : au repos un
        // remplissage neutre, posée le fond doux de l'accent — la valeur remplace le libellé.
        className={`${chipCls(active)} max-w-full`}
      >
        {icon}
        <span className="max-w-[14rem] truncate">{value || label}</span>
        {Boolean(value) && onClear && !neutral ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={t("library:removeFilter", { name: label })}
            onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onClear(); setOpen(false); } }}
            className="-mr-1.5 flex h-5 w-5 items-center justify-center rounded-full transition-colors duration-hover hover:bg-accent/20"
          >
            <XIcon size={11} weight="bold" aria-hidden />
          </span>
        ) : (
          // Le chevron ne tourne pas : un menu s'ouvre des dizaines de fois par séance.
          <CaretDownIcon size={12} weight="bold" aria-hidden className="-mr-0.5 opacity-70" />
        )}
      </button>

      {/* Le calque commun : une pastille près du bord droit ne pousse plus son panneau hors de la fenêtre. */}
      <FloatingLayer
        open={open}
        anchor={rootRef}
        onDismiss={() => setOpen(false)}
        side="bottom"
        align={align === "right" ? "end" : "start"}
        // La peau du menu du socle (opaque : aucun flou à payer derrière un fond plein).
        className="lg-menu lg-filter ui-menu overflow-y-auto overscroll-contain"
        style={{ width }}
      >
        {closeButton && (
          <div className="mb-1 flex items-center justify-between gap-3 pl-2.5">
            <span className="truncate text-sm font-semibold text-content-primary">{label}</span>
            <button
              type="button"
              data-menu-close
              onClick={closeFromPanel}
              aria-label={t("common:close")}
              className="icon-btn btn-sm"
            >
              <XIcon size={18} aria-hidden />
            </button>
          </div>
        )}
        {children}
      </FloatingLayer>
    </div>
  );
}
