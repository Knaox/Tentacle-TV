import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon } from "../icons/HeroIcons";

interface CardMoreInfoButtonProps {
  /** Id du média à ouvrir dans la page détail (/media/:id). */
  detailId: string;
  /** Carte parente survolée — pilote l'apparition. */
  visible: boolean;
}

/**
 * « Plus d'infos » discret sur la carte 16/9 : au survol, une grande flèche
 * (sans cercle) apparaît en bas à droite — dans la zone réservée (pr-28 du
 * titre), donc sans jamais chevaucher le titre. Clic → fiche détaillée
 * (stoppe la propagation, pas de lecture).
 *
 * Ce bouton n'assombrit plus le bas de la carte : `EpisodeCard` pose désormais
 * son propre scrim (`--card-reveal-scrim`), et les deux cumulés viraient au
 * noir plein au survol.
 */
export function CardMoreInfoButton({ detailId, visible }: CardMoreInfoButtonProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigate(`/media/${detailId}`);
  };

  // Bouton + scrim posés directement SUR la carte (image 16/9) : restent en
  // blanc/noir dans les deux thèmes, comme les autres overlays de carte
  // (cf. règle « posé sur média »).
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {/* Grande flèche sans cercle, bas-droite (zone réservée pr-28 du titre). */}
      <button
        type="button"
        onClick={handleClick}
        aria-label={t("common:moreInfo")}
        title={t("common:moreInfo")}
        className="pointer-events-auto absolute bottom-0.5 right-1.5 flex h-8 w-8 items-center justify-center text-white/90 transition-transform duration-150 hover:scale-110 hover:text-white"
      >
        <ChevronDownIcon className="h-6 w-6 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]" />
      </button>
    </div>
  );
}
