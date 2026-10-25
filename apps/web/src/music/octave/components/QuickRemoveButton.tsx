/**
 * Octave — le « − » d'une rangée de playlist : retire le titre de CETTE playlist d'un geste. Pas de confirmation :
 * l'avis porte « Annuler », qui le remet à sa place (retour de Damien du 25/10). Révélé au survol, atteignable au
 * clavier ; le nom accessible dit quel titre part.
 */

import { memo } from "react";
import { CircleMinus } from "lucide-react";
import { useTranslation } from "react-i18next";

const HOVER_CLASS = "octave-hover-reveal opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100";

export const QuickRemoveButton = memo(function QuickRemoveButton({ title, onRemove }: { title: string; onRemove: () => void }) {
  const { t } = useTranslation("music");
  const label = t("playlist.removeQuick", { title });
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-content-tertiary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${HOVER_CLASS}`}
    >
      <CircleMinus className="h-4 w-4" aria-hidden />
    </button>
  );
});
