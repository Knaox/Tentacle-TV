import type { MouseEvent } from "react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EyeOff } from "lucide-react";
import { recoMarkerItem, type RecoRowItem } from "@tentacle-tv/api-client";
import { CardActionTray, CardTrayButton, CardTrayCapsule, TRAY_SIZE } from "../cards/CardActionTray";
import { PosterHoverShell } from "../cards/PosterHoverShell";
import { CardMetaOverlay } from "../media/CardMetaOverlay";
import { HoverRatingStars } from "../rating/HoverRatingStars";
import { useRecoPlayTarget } from "./useRecoPlayTarget";

interface RecoPosterHoverLayerProps {
  item: RecoRowItem;
  /** Cible du fondu : vrai au survol, faux le temps du sursis de démontage. */
  visible: boolean;
  /** « Ne plus me proposer » — le plateau arrête déjà le clic (pas de navigation). */
  onDismiss: () => void;
  /** Ouverture de la fiche AVEC sa transition — repli du bouton Lecture. */
  onOpenDetail: () => void;
}

/**
 * Le survol d'une carte de recommandation — le MÊME que celui des affiches de
 * bibliothèque (`PosterHoverShell`) : voile, Lecture au centre, étoiles et
 * plateau en bas. La recommandation n'y ajoute qu'une chose, au bout du
 * plateau : « Ne plus me proposer », un bouton de capsule comme les autres.
 *
 * Titre hors bibliothèque : ni Lecture ni bascules (il n'y a pas d'item
 * Jellyfin à mettre dans Ma liste) — les étoiles (par tmdb) et le refus
 * restent, dans la même capsule.
 *
 * Monté au survol seulement : la cible de lecture (une ou deux requêtes), les
 * Sets du plateau et la liste des notes n'existent que le temps du survol.
 */
export function RecoPosterHoverLayer({ item, visible, onDismiss, onOpenDetail }: RecoPosterHoverLayerProps) {
  const { t } = useTranslation("reco");
  const navigate = useNavigate();
  // Lecture (reprise, sinon l'épisode à suivre) — null hors bibliothèque.
  const target = useRecoPlayTarget(item.jellyfinItemId, item.mediaType);
  const ratingIdentity = {
    mediaType: item.mediaType === "tv" ? ("series" as const) : ("movie" as const),
    tmdbId: item.tmdbId,
  };
  // Le plateau bascule le FILM chargé pour la lecture (son UserData dit s'il
  // est déjà dans Ma liste) ; une série répond par les Sets partagés.
  const { key, mediaType, tmdbId, title, jellyfinItemId } = item;
  const face = useMemo(() => recoMarkerItem({ key, mediaType, tmdbId, title, jellyfinItemId }), [key, mediaType, tmdbId, title, jellyfinItemId]);
  const trayItem = mediaType === "movie" && target?.media?.Id === jellyfinItemId ? target?.media ?? face : face;

  const onPlay = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!target || target.kind === "detail") onOpenDetail();
    else navigate(target.path);
  };

  const dismiss = (
    <CardTrayButton box={TRAY_SIZE.sm.box} active={false} label={t("dismissAction")} onPress={onDismiss}>
      <EyeOff className={TRAY_SIZE.sm.icon} aria-hidden />
    </CardTrayButton>
  );

  return (
    <>
      {/* Qualité et langues de ce qui va être lu — le film, ou l'épisode résolu. */}
      {target?.media && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <CardMetaOverlay item={target.media} density="compact" reveal="mount" shown={visible} />
        </div>
      )}
      <PosterHoverShell visible={visible} play={target ? { label: `${target.label} — ${item.title}`, onPlay } : null}>
        <div className="flex justify-center">
          <HoverRatingStars identity={ratingIdentity} jellyfinItemId={jellyfinItemId} />
        </div>
        {jellyfinItemId ? (
          <CardActionTray item={trayItem} size="sm" stretch>
            {dismiss}
          </CardActionTray>
        ) : (
          // Un seul bouton : la capsule épouse son contenu, au centre.
          <div className="flex justify-center">
            <CardTrayCapsule label={item.title}>{dismiss}</CardTrayCapsule>
          </div>
        )}
      </PosterHoverShell>
    </>
  );
}
