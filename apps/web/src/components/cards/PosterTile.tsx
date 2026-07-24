import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSeriesWatchState } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardFrame } from "./CardFrame";
import { CardImage } from "./CardImage";
import { CardProgressBar } from "./CardProgressBar";
import { CardQuickActions } from "./CardQuickActions";
import { playTargetPath } from "./playTarget";
import { CardMetaOverlay } from "../media/CardMetaOverlay";
import { InfoIcon, PlayIcon } from "../icons/HeroIcons";
import { PressableScale } from "../ui/PressableScale";

interface PosterTileProps {
  item: MediaItem;
  imageUrl: string;
  /** Piloté par le parent, qui possède aussi le popover et le menu contextuel. */
  hovered: boolean;
  /** Compteur d'épisodes ajoutés d'un coup — tuile série groupée. */
  addedCount?: number;
  /**
   * Actions en surimpression sur l'affiche. Le parent les coupe quand le
   * panneau d'aperçu prend le relais : les avoir aux deux endroits donnait
   * deux jeux de boutons superposés au survol.
   */
  showActions?: boolean;
}

/**
 * Affiche 2:3 partagée par les rangées d'accueil et la grille de bibliothèque.
 * Ces deux surfaces avaient divergé (rayons, ombres, actions, couleurs en dur) ;
 * elles n'ont plus qu'une seule définition.
 *
 * Tout ce qui est POSÉ SUR l'affiche — scrims, badges, contrôles — reste
 * blanc/noir constant dans les deux schémas : c'est la luminosité du poster qui
 * commande le contraste, pas le thème choisi.
 */
export function PosterTile({
  item,
  imageUrl,
  hovered,
  addedCount = 0,
  showActions = true,
}: PosterTileProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  const watched = item.UserData?.Played === true;
  const progress = item.UserData?.PlayedPercentage;
  const grouped = addedCount > 1;
  const actionsVisible = showActions && hovered;

  // Épisode à lancer pour une SÉRIE — résolu au survol seulement.
  // La requête coûte un appel par série : la déclencher au montage
  // rendrait une grille de bibliothèque insoutenable. Au survol, il n'y en a
  // qu'une à la fois, et `staleTime: 60s` couvre les allers-retours.
  const isSeries = item.Type === "Series";
  const { data: watchState } = useSeriesWatchState(hovered && isSeries ? item.Id : undefined);

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isSeries) {
      // `useSeriesWatchState` couvre les deux cas d'un seul coup : `continue`
      // rend l'épisode entamé, `next` le premier non vu — donc « reprendre »
      // ET « commencer ». Série terminée (ou état pas encore chargé) : on
      // ouvre la fiche plutôt que de lancer un épisode au hasard.
      const epId = watchState?.type !== "completed" ? watchState?.episode?.Id : undefined;
      navigate(epId ? `/watch/${epId}` : `/media/${item.Id}`);
      return;
    }
    navigate(playTargetPath(item));
  };

  const handleInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigate(`/media/${item.Id}`);
  };

  return (
    <CardFrame hovered={hovered} aspect="aspect-[2/3]">
      <CardImage src={imageUrl} alt={item.Name} />

      {/* Compteur d'épisodes récemment ajoutés : posé sur un aplat de MARQUE
          (dégradé brand) et non sur l'affiche — d'où le token dédié. */}
      {grouped && (
        <div className="absolute left-2 top-2 z-10 rounded-md bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] px-1.5 py-0.5 text-[11px] font-bold leading-none text-cta-brand-fg shadow-[0_2px_8px_rgba(var(--brand-rgb),0.45)]">
          +{addedCount}
        </div>
      )}

      {/* Méta discrète révélée au survol. Masquée sur un lot d'épisodes : la
          qualité d'un seul épisode ne dit rien du groupe. */}
      {!grouped && <CardMetaOverlay item={item} density="compact" reveal="hover" />}

      {/* Actions rapides — colonne d'angle, au survol uniquement. */}
      {showActions && (
        <div
          className="absolute right-2 top-2 z-20 transition-opacity duration-150"
          style={{ opacity: actionsVisible ? 1 : 0, pointerEvents: actionsVisible ? "auto" : "none" }}
        >
          <CardQuickActions item={item} variant="compact" />
        </div>
      )}

      {/* Coche « vu » — cède la place aux actions rapides pendant le survol. */}
      {watched && !actionsVisible && (
        <div className="absolute right-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black shadow">
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Barre d'actions qui remonte du bas. Le scrim n'apparaît QU'AU survol :
          au repos, l'affiche reste entièrement propre. */}
      {showActions && (
        <div
          className="absolute inset-x-0 bottom-0 z-20 transition-opacity duration-200"
          style={{ opacity: actionsVisible ? 1 : 0, pointerEvents: actionsVisible ? "auto" : "none" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
            style={{ background: "var(--card-reveal-scrim)" }}
          />
          {/* Lecture à gauche, accès à la fiche à droite : les deux seules
              destinations d'une affiche. Le clic sur la carte ouvre déjà la
              fiche, mais rien ne le signalait — d'où ce repère explicite. */}
          <div className="relative flex items-center justify-between px-2 pb-2.5">
            <PressableScale
              onClick={handlePlay}
              aria-label={t("common:play")}
              title={t("common:play")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-cta-primary-border bg-cta-primary-bg text-cta-primary-fg"
              style={{ boxShadow: "var(--elev-2)" }}
            >
              <PlayIcon />
            </PressableScale>

            <PressableScale
              onClick={handleInfo}
              aria-label={t("common:moreInfo")}
              title={t("common:moreInfo")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.5)] text-on-media-primary backdrop-blur-sm transition-colors hover:bg-[rgba(var(--scrim-media-rgb),0.7)]"
            >
              <InfoIcon className="h-4 w-4" />
            </PressableScale>
          </div>
        </div>
      )}

      {!watched && <CardProgressBar percent={progress} />}
    </CardFrame>
  );
}
