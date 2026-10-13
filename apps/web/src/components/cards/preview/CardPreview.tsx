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
   * L'item Jellyfin dont le LOGO s'écrit sur la vidéo, quand la donnée en
   * annonce un (`resolveLogoImage` : le sien, celui de la série d'un épisode).
   * Absent hors bibliothèque : le nom.
   */
  logoItem?: MediaItem | null;
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
export function CardPreview({ controller, title, logoItem = null, children }: CardPreviewProps) {
  const { session } = controller;
  const wanted = session.hovered && session.subject !== null && !session.disabled;
  const active = useMountWhile(wanted, SESSION_LINGER_MS);
  if (!active) return null;
  return (
    <PreviewSession controller={controller} title={title} logoItem={logoItem}>
      {children}
    </PreviewSession>
  );
}

function PreviewSession({ controller, title, logoItem, children }: Required<CardPreviewProps>) {
  const view = usePreviewSession(controller.session);
  if (!view || typeof document === "undefined") return null;
  return createPortal(
    <PreviewFrame view={view} title={title} logoItem={logoItem}>
      {children}
    </PreviewFrame>,
    document.body,
  );
}
