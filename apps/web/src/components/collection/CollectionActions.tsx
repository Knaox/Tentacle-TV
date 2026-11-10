import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CheckSquareIcon as CheckSquare } from "@phosphor-icons/react/dist/csr/CheckSquare";
import { ShareMyListButton } from "../share/ShareMyListButton";
import { chipCls } from "../library/filterChip";

interface CollectionActionsProps {
  /** Quelle liste le lien public montre. */
  shareKind: "watchlist" | "likes";
  /** Entrer en sélection — absent quand il n'y a rien à sélectionner. */
  onSelect?: () => void;
  /** Un geste propre à la page, posé au bout (la bascule grille / liste). */
  extra?: ReactNode;
}

/**
 * Les gestes d'une collection, au bout de l'étage haut du panneau : partager,
 * puis sélectionner (la pilule neutre du socle, la même que les filtres). Ma liste et Mes
 * favoris les posent au même endroit, dans le même ordre.
 */
export function CollectionActions({ shareKind, onSelect, extra }: CollectionActionsProps) {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ShareMyListButton kind={shareKind} />
      {onSelect && (
        <button
          type="button"
          onClick={onSelect}
          className={chipCls(false)}
        >
          <CheckSquare aria-hidden size={14} weight="bold" />
          {t("common:select")}
        </button>
      )}
      {extra}
    </div>
  );
}
