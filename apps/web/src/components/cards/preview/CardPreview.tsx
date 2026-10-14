import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { MediaItem } from "@tentacle-tv/shared";
import { useMountWhile } from "../../../hooks/useMountWhile";
import { PreviewFrame } from "./PreviewFrame";
import { PREVIEW_ENGINE_EXIT_MS } from "./engine";
import { usePreviewSession } from "./usePreviewSession";
import type { CardPreviewController } from "./useCardPreview";

/**
 * Le temps qu'une session survit à la fin du survol : le fondu de sortie du
 * moteur (la vidéo, le son qui décroît) et un retour du pointeur pendant ce
 * fondu, qui reprend la lecture là où elle en était.
 */
const SESSION_LINGER_MS = PREVIEW_ENGINE_EXIT_MS + 120;

interface CardPreviewProps {
  controller: CardPreviewController;
  /** Le nom du titre — lu par les lecteurs d'écran, écrit quand Jellyfin n'a pas de logo. */
  title: string;
  /**
   * L'item Jellyfin du titre : son LOGO s'écrit sur la vidéo et son FOND 16:9
   * se montre pendant l'agrandissement, quand la donnée les annonce (ceux de
   * la série pour un épisode). Absent hors bibliothèque : le nom, la vidéo.
   */
  artItem?: MediaItem | null;
  /**
   * La fiche Jellyfin à lire pour le logo quand la carte n'a pas d'item (une
   * recommandation de la bibliothèque) ; avec `artItem`, c'est son `Id`.
   */
  detailItemId?: string | null;
  /**
   * L'image 16:9 montrée pendant l'agrandissement, quand la carte en sait plus
   * que la donnée : l'image même d'une vignette (continuité parfaite), le fond
   * TMDB d'une recommandation. Prime sur le fond de `artItem`.
   */
  backdropUrl?: string | null;
  /**
   * Le survol de la carte, rendu tel quel dans la mini-carte : le MÊME
   * composant que sur la carte (`CardHoverOverlay`, `ExternalHoverOverlay`),
   * avec `surface="preview"`. `visible` suit la mini-carte.
   */
  children: (visible: boolean) => ReactNode;
}

/**
 * La MINI-CARTE d'aperçu : la bande-annonce d'une carte, en 16:9, un peu
 * plus grande qu'elle, au-dessus des rangées — rendue dans un PORTAIL fixé
 * à l'écran, qu'aucun `overflow` de rangée ne rogne.
 *
 * Rendue par la carte, DANS son arbre React : souris, clics et focus y
 * remontent jusqu'à elle. Passer de la carte à la mini-carte ne ferme donc
 * rien, et cliquer sur la vidéo fait exactement ce que fait le clic de la
 * carte (la fiche pour une affiche, la lecture pour une vignette 16:9). Les
 * boutons — son, étoiles, plateau — arrêtent leur clic, comme sur la carte.
 *
 * La SESSION (moteur, requête, mini-carte) n'existe que pendant le survol :
 * au repos, une carte ne porte qu'une ancre et un booléen.
 */
export function CardPreview({
  controller,
  title,
  artItem = null,
  detailItemId = null,
  backdropUrl = null,
  children,
}: CardPreviewProps) {
  const { session } = controller;
  const wanted = session.hovered && session.subject !== null && !session.disabled;
  const active = useMountWhile(wanted, SESSION_LINGER_MS);
  if (!active) return null;
  return (
    <PreviewSession controller={controller} title={title} artItem={artItem} detailItemId={detailItemId} backdropUrl={backdropUrl}>
      {children}
    </PreviewSession>
  );
}

function PreviewSession({ controller, title, artItem, detailItemId, backdropUrl, children }: Required<CardPreviewProps>) {
  const view = usePreviewSession(controller.session);
  if (!view || typeof document === "undefined") return null;
  return createPortal(
    <PreviewFrame view={view} title={title} artItem={artItem} detailItemId={detailItemId} backdropUrl={backdropUrl}>
      {children}
    </PreviewFrame>,
    document.body,
  );
}
