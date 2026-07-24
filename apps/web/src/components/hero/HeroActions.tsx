import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { PlayIcon, InfoIcon } from "../icons/HeroIcons";
import { PressableScale } from "../ui/PressableScale";
import { CardQuickActions } from "../cards/CardQuickActions";

interface HeroActionsProps {
  item: MediaItem;
  onPlay: () => void;
  /** Reprise en cours — bascule le libellé du CTA principal. */
  resuming: boolean;
  /** Code S/E affiché en suffixe du CTA quand une reprise est proposée. */
  episodeCode: string | null;
}

/**
 * Groupe d'actions de la bannière.
 *
 * La version précédente n'offrait QUE « Lecture », ce qui laissait la bannière
 * sans aucun chemin vers la fiche détail : depuis l'accueil, il fallait
 * retrouver le titre dans une rangée pour lire un synopsis complet ou choisir
 * un épisode. Le CTA secondaire comble ce trou ; il reste en verre discret pour
 * que la hiérarchie visuelle continue de désigner « Lecture ».
 */
export function HeroActions({ item, onPlay, resuming, episodeCode }: HeroActionsProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <PressableScale
        onClick={onPlay}
        className="flex items-center gap-2.5 rounded-full border border-cta-primary-border bg-cta-primary-bg px-7 py-3 text-base font-bold text-cta-primary-fg transition-colors duration-200 hover:bg-cta-primary-bg-hover"
        style={{ boxShadow: "var(--elev-2)" }}
      >
        <PlayIcon />
        {resuming ? t("common:resume") : t("common:play")}
        {episodeCode && <span className="font-semibold opacity-60">{episodeCode}</span>}
      </PressableScale>

      {/* Posé sur l'affiche : verre sombre + texte blanc constants, plutôt que
          les tokens `--cta-ghost-*` qui suivent le fond de PAGE. */}
      <PressableScale
        onClick={() => navigate(`/media/${item.Id}`)}
        className="flex items-center gap-2 rounded-full border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.45)] px-6 py-3 text-base font-semibold text-on-media-primary backdrop-blur-md transition-colors duration-200 hover:bg-[rgba(var(--scrim-media-rgb),0.65)]"
      >
        <InfoIcon />
        {t("common:moreInfo")}
      </PressableScale>

      <div className="ml-1 hidden sm:block">
        <CardQuickActions item={item} variant="inline" />
      </div>
    </div>
  );
}
