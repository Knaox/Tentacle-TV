import { useEffect, useRef, useState, type RefObject } from "react";
import { trailerPreviewSubjectKey, type MediaItem } from "@tentacle-tv/shared";
import { previewSubjectOfItem, previewSubjectOfTitle, trackPreviewWarm, type PreviewMediaType, type PreviewSubject } from "./engine";
import type { PreviewShape } from "./previewPlacement";

/** De quoi une carte montrerait la bande-annonce : un titre de la bibliothèque, ou un titre TMDB. */
export type CardPreviewSource =
  | { item: Pick<MediaItem, "Id" | "Type" | "SeriesId" | "ParentId"> | null | undefined }
  | { title: { mediaType: PreviewMediaType; tmdbId: number } | null | undefined };

export interface CardPreviewOptions {
  source: CardPreviewSource;
  /** Le survol de la carte — pointeur ou focus clavier —, tel que la carte le tient. */
  hovered: boolean;
  /** Le format de la carte : la taille de la mini-carte et le départ de son animation. */
  shape: PreviewShape;
  /**
   * L'élément de la mini-carte, partagé avec le survol clavier de la carte
   * (`useCardHover().companionRef`) : un focus qui y entre ne quitte pas la carte.
   */
  companionRef?: RefObject<HTMLDivElement | null>;
  /** Couper l'aperçu : menu contextuel ouvert, sélection multiple, plateau masqué. */
  disabled?: boolean;
}

/** Ce que la session d'aperçu (`CardPreview`) reçoit de sa carte. */
export interface CardPreviewSession {
  subject: PreviewSubject | null;
  hovered: boolean;
  shape: PreviewShape;
  disabled: boolean;
  anchorRef: RefObject<HTMLDivElement | null>;
  portalRef: RefObject<HTMLDivElement | null>;
  /** La session dit à la carte quand la mini-carte est vue. */
  setShown: (shown: boolean) => void;
}

export interface CardPreviewController {
  /** La mini-carte est vue : la carte s'efface dessous, son propre survol se retire. */
  shown: boolean;
  /** À poser sur le visuel de la carte (`CardFrame`) : l'ancre de la place et du départ. */
  anchorRef: RefObject<HTMLDivElement | null>;
  session: CardPreviewSession;
}

function subjectOf(source: CardPreviewSource): PreviewSubject | null {
  return "item" in source ? previewSubjectOfItem(source.item) : previewSubjectOfTitle(source.title);
}

/**
 * L'aperçu de bande-annonce d'une carte, côté CARTE — volontairement léger :
 * une ancre, un booléen. Tout le reste (le moteur, sa requête, ses
 * abonnements, la mini-carte) vit dans la session que `CardPreview` ne monte
 * que pendant le survol : quatre-vingts cartes au repos ne portent rien.
 *
 * La carte garde son survol : elle passe `hovered`, lit `shown` pour
 * s'effacer sous la mini-carte, et rend `<CardPreview controller={…}>` DANS
 * son arbre — React y fait remonter souris, clics et focus jusqu'à elle.
 *
 * Son visuel est inscrit auprès de la préparation des aperçus
 * (`trackPreviewWarm`, un seul observateur pour toute l'app) : à l'écran, son
 * titre se prépare chez le serveur avant tout survol.
 */
export function useCardPreview({ source, hovered, shape, companionRef, disabled = false }: CardPreviewOptions): CardPreviewController {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const ownPortalRef = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  const subject = subjectOf(source);
  const subjectKey = subject ? trailerPreviewSubjectKey(subject) : null;
  // Le sujet n'a d'identité que par sa clé : une carte qui le reconstruit à chaque rendu ne réinscrit rien.
  const subjectRef = useRef(subject);
  subjectRef.current = subject;
  useEffect(() => {
    const element = anchorRef.current;
    const current = subjectRef.current;
    if (!element || !current || subjectKey === null) return;
    return trackPreviewWarm(element, current);
  }, [subjectKey]);
  return {
    shown,
    anchorRef,
    session: {
      subject,
      hovered,
      shape,
      disabled,
      anchorRef,
      portalRef: companionRef ?? ownPortalRef,
      setShown,
    },
  };
}
