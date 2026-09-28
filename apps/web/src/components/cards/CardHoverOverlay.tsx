import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useCardFace, useCardRatingTarget, type RatingIdentity } from "@tentacle-tv/api-client";
import {
  CARD_TOGGLE_ORDER,
  resolveCardOverlay,
  type CardOverlayVariant,
  type CardToggleHandlers,
  type MediaItem,
} from "@tentacle-tv/shared";
import { CardActionTray } from "./CardActionTray";
import { CardHoverShell } from "./CardHoverShell";
import { CardMetaOverlay } from "../media/CardMetaOverlay";
import { HoverRatingStars } from "../rating/HoverRatingStars";
import { supportsDownloads } from "../../desktop/bridge";

interface CardHoverOverlayProps {
  variant: CardOverlayVariant;
  /** Le visage Jellyfin de la carte — bascules, hors ligne, note. `null` hors bibliothèque. */
  item: MediaItem | null;
  /** Le titre de la carte, lu par les lecteurs d'écran. */
  title: string;
  /** Cible du fondu : vrai pendant le survol, faux pendant le sursis de sortie. */
  visible: boolean;
  /**
   * La lecture — `null` quand rien ne se lance d'ici. `label` remplace le
   * libellé du modèle quand l'appelant en sait plus (« Reprendre S2 · E5 »).
   */
  play: { resume: boolean; label?: string; onPlay: (e: MouseEvent) => void } | null;
  /** Ce que notent les étoiles d'un titre hors bibliothèque (son tmdb). */
  ratingIdentity?: RatingIdentity | null;
  /** L'item dont les puces qualité/langues sont montrées (le film, l'épisode résolu). */
  meta?: MediaItem | null;
  /** Extra « fiche » d'une vignette dont le clic lance la lecture. */
  onOpenDetails?: () => void;
  /** Extra « Ne plus me proposer » d'une recommandation. */
  onDismiss?: () => void;
  /**
   * Titre lu sur le DISQUE (catalogue local) : seule la coche « vu », dont
   * l'appelant fournit l'état et le geste ; ni note ni requête au serveur.
   */
  local?: CardToggleHandlers;
}

/**
 * LE survol des cartes du web — un composant, trois variantes (`poster`,
 * `landscape`, `reco`), une seule grammaire : puces qualité/langues en haut à
 * gauche, voile, Lecture au centre, étoiles puis plateau (Ma liste, favori,
 * vu, et les extras). Ce qu'il offre, et dans quel ordre, vient du modèle
 * partagé (`resolveCardOverlay`) : la feuille d'appui long du mobile et le
 * menu de la télécommande en rendent exactement la même liste.
 *
 * MONTÉ au survol seulement, par l'appelant (`useMountWhile`) : ses étoiles
 * s'abonnent à la liste des notes, son plateau aux Sets de séries, et la
 * cible de notation d'un épisode charge sa série. Quatre-vingts cartes ne
 * doivent pas porter tout cela au repos.
 */
export function CardHoverOverlay({
  variant,
  item,
  title,
  visible,
  play,
  ratingIdentity,
  meta,
  onOpenDetails,
  onDismiss,
  local,
}: CardHoverOverlayProps) {
  const { t } = useTranslation("cards");
  const landscape = variant === "landscape";
  // Une carte qui n'a qu'un résumé (recherche, similaires) prend sa fiche
  // complète : tmdb pour les étoiles, état frais pour le plateau. Un titre
  // local ne demande rien au serveur.
  const { face: served, pending: facePending } = useCardFace(local ? null : item, { enabled: true });
  const face = local ? item : served;
  // Une identité fournie (titre hors bibliothèque) court-circuite la
  // résolution — et sa requête de série.
  const target = useCardRatingTarget(ratingIdentity === undefined && !local ? face : null, {
    scope: landscape ? "item" : "series",
    enabled: true,
  });
  const identity = ratingIdentity === undefined ? target.identity : ratingIdentity;
  const jellyfinItemId = ratingIdentity === undefined ? target.jellyfinItemId : (item?.Id ?? null);
  // Les puces montrent la fiche complète quand c'est le même titre.
  const metaItem = meta && face && meta.Id === face.Id ? face : meta;

  const overlay = resolveCardOverlay({
    variant,
    inLibrary: item !== null,
    playable: play !== null,
    resume: play?.resume,
    rateable: identity !== null || target.pending || facePending,
    offline: supportsDownloads(),
    local: local !== undefined,
  });
  const playLabel = overlay.play && play ? `${play.label ?? t(overlay.play.labelKey)} — ${title}` : null;
  const hasTray = overlay.toggles.length > 0 || overlay.extras.length > 0;
  // Pleine largeur sur une affiche seulement quand le plateau est complet :
  // une capsule d'un ou deux boutons (hors bibliothèque, titre local) épouse
  // son contenu, au centre — étirée, un bouton seul flotterait au bord.
  const stretch = !landscape && overlay.toggles.length >= CARD_TOGGLE_ORDER.length;

  return (
    <>
      {metaItem && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <CardMetaOverlay item={metaItem} density={landscape ? "full" : "compact"} reveal="mount" shown={visible} />
        </div>
      )}
      <CardHoverShell
        variant={variant}
        visible={visible}
        play={playLabel && play ? { label: playLabel, onPlay: play.onPlay } : null}
      >
        {overlay.rate && (
          <div className={landscape ? "flex justify-end" : "flex justify-center"}>
            {identity ? (
              <HoverRatingStars identity={identity} jellyfinItemId={jellyfinItemId} />
            ) : (
              // La série se charge : la place des étoiles est gardée, le
              // plateau ne saute pas quand elles arrivent.
              <div aria-hidden className="h-4" />
            )}
          </div>
        )}
        {hasTray && (
          <div className={landscape ? "flex justify-end" : stretch ? "" : "flex justify-center"}>
            <CardActionTray
              item={face}
              overlay={overlay}
              label={title}
              size={landscape ? "md" : "sm"}
              stretch={stretch}
              onOpenDetails={onOpenDetails}
              onDismiss={onDismiss}
              localToggles={local}
            />
          </div>
        )}
      </CardHoverShell>
    </>
  );
}
