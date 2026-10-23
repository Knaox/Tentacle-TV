import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { heroBackdropUrl } from "./resolveBackdrop";
import { captureDetailOrigin } from "../detail/detailTransition";
import { PlayIcon, InfoIcon } from "../icons/HeroIcons";
import { PressableGlass } from "../ui/glass/PressableGlass";
import { GlassLensScope } from "../../theme/glass";
import { CardQuickActions } from "../cards/CardQuickActions";
import { CardDownloadAction } from "../../downloads/CardDownloadAction";

/**
 * Les deux boutons de la bannière, partagés avec le bandeau de l'accueil hors
 * ligne : même poids, même verre, à la classe près.
 */
// `hero-cta-primary` : le dégradé de marque de l'Apple TV, ses voiles d'appui
// et son anneau de focus (theme/heroCta.css) — la peau d'AVANT (hors verre
// natif), qui garde aussi le focus d'entrée des TV LG (`[class*="cta-primary"]`).
export const HERO_PLAY_CLASS = "hero-cta-primary rounded-full";
export const HERO_PLAY_STYLE = { boxShadow: "var(--elev-2)" };
/** Posé sur l'affiche : verre sombre + texte blanc constants, jamais les tokens `--cta-ghost-*` du fond de PAGE. */
export const HERO_INFO_CLASS =
  "rounded-full border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.45)] text-on-media-primary backdrop-blur-md transition-colors duration-200 hover:bg-[rgba(var(--scrim-media-rgb),0.65)]";

/**
 * Les deux boutons du héros, prêts à étaler sur `PressableGlass` : la mise en
 * page (tous les modes), la peau d'avant (hors verre natif) et le verre natif
 * — « Lecture » porte la marque DANS le verre (`prominent`), « Plus d'infos »
 * est un verre clair aux glyphes adaptés au décor.
 */
export const HERO_PLAY_PROPS = {
  appearance: { level: "prominent", tint: "brand", shape: "capsule" },
  className: "flex items-center gap-2.5 px-7 py-3 text-base font-bold",
  fallbackClassName: HERO_PLAY_CLASS,
  fallbackStyle: HERO_PLAY_STYLE,
} as const;
export const HERO_INFO_PROPS = {
  appearance: { level: "clear", shape: "capsule" },
  className: "flex items-center gap-2 px-6 py-3 text-base font-semibold",
  fallbackClassName: HERO_INFO_CLASS,
} as const;

interface HeroActionsProps {
  item: MediaItem;
  onPlay: () => void;
  /** Reprise en cours — bascule le libellé du CTA principal. */
  resuming: boolean;
  /** Code S/E affiché en suffixe du CTA quand une reprise est proposée. */
  episodeCode: string | null;
  /** L'image que la bannière montre — la transition d'ouverture reprend
   *  CELLE-LÀ (un repli sur l'affiche, pas un fond en 404). Absente : le fond
   *  de `heroBackdropUrl`. */
  imageUrl?: string | null;
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
export function HeroActions({ item, onPlay, resuming, episodeCode, imageUrl }: HeroActionsProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const client = useJellyfinClient();

  /**
   * Ouverture de la fiche depuis la bannière. Elle se faisait jusqu'ici par une
   * coupure sèche : un plein écran remplacé par un autre, sans le moindre lien
   * entre les deux, alors que toutes les autres cartes de l'accueil ouvrent la
   * fiche par une transition d'élément partagé.
   *
   * C'est exactement le même trajet que celui d'une carte : le visuel rejoint
   * la place que la fiche lui réserve. Une première version faisait plutôt
   * s'ouvrir la bannière jusqu'au plein écran, au motif qu'elle EST déjà le
   * décor de la page d'arrivée — mais le visuel finissait alors nulle part,
   * c'est-à-dire le défaut même qu'une transition doit corriger.
   *
   * Le cadre de la bannière est mesuré ICI, au clic — c'est le dernier instant
   * où il existe. Son rayon est LU sur l'élément plutôt qu'écrit en dur : il
   * suit ainsi le token `--hero-frame-radius` sans dépendance croisée.
   */
  const openDetail = (e: React.MouseEvent) => {
    const frame = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-hero-frame]");
    const url = imageUrl !== undefined ? imageUrl : heroBackdropUrl(client, item);
    if (frame && url) {
      const radius = parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 0;
      captureDetailOrigin(frame, item.Id, url, radius);
    }
    navigate(`/media/${item.Id}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <PressableGlass {...HERO_PLAY_PROPS} onClick={onPlay}>
        <PlayIcon />
        {resuming ? t("common:resume") : t("common:play")}
        {/* Blanc plein, graisse moindre : une opacité réduite passait sous 3:1 sur le dégradé. */}
        {episodeCode && <span className="font-medium">{episodeCode}</span>}
      </PressableGlass>

      <PressableGlass {...HERO_INFO_PROPS} onClick={openDetail}>
        <InfoIcon />
        {t("common:moreInfo")}
      </PressableGlass>

      {/* Les petits ronds, posés sur une image qui bouge sans cesse : du givre SANS
          lentille (lot lg5, décision de Damien du 23/10) — chacune se recalculait
          à chaque pas du héros, pour une réfraction invisible à 36 px. « Lecture »
          et « Plus d'infos » gardent la leur. */}
      <GlassLensScope lens={false}>
        <div className="ml-1 hidden items-center gap-1.5 sm:flex">
          <CardQuickActions item={item} variant="inline" />
          {/* La bannière n'est pas montée au survol : une seule instance, et un
              seul abonnement à la file des téléchargements pour tout l'écran. */}
          <CardDownloadAction item={item} variant="inline" />
        </div>
      </GlassLensScope>
    </div>
  );
}
