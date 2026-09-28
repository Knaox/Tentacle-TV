import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { createLongPress } from "../../focus/longPress";
import { CardActionSheetTv } from "../cards/CardActionSheetTv";
import { useSheetFocusReturn } from "../cards/useSheetFocusReturn";

/**
 * Rend une ligne d'épisode atteignable à la télécommande.
 *
 * C'était le défaut le plus grave de la cible, et le plus simple à énoncer :
 * **on ne pouvait pas lancer un épisode depuis la fiche d'une série.** La ligne
 * du client web est un `<div onClick>` sans `tabIndex` ni `role` — invisible au
 * moteur de navigation. Le seul élément focusable qu'elle contenait était la
 * pastille « marquer comme vu », vingt pixels de côté, sans libellé. En
 * descendant dans la liste, l'anneau sautait de coche en coche en enjambant les
 * épisodes.
 *
 * L'enveloppe suit exactement le modèle de `FocusableCard` : elle **entoure**
 * la ligne du web au lieu de la remplacer, donc la vignette, la barre de
 * progression, les pastilles de qualité et le synopsis restent ceux d'`apps/web`
 * et continueront de le suivre.
 *
 * **Appui court, appui long.** Bref lance l'épisode ; maintenu ouvre ses
 * ACTIONS — celles d'une vignette 16:9 (`CardActionSheetTv`, variante
 * `landscape`) : Reprendre, vu, la note de l'épisode, et sa fiche. C'est le
 * seul endroit du téléviseur où l'on peut marquer un épisode vu ou le noter
 * sans quitter la liste — la bascule « vu » de la ligne du web y est masquée.
 *
 * `data-tv-cle` porte l'identifiant Jellyfin : c'est ce qui permet à la mémoire
 * de focus de retrouver CET épisode au retour du lecteur, là où un libellé
 * traduit ou une position dans la liste ne le garantiraient pas.
 */

interface EpisodeRowTvProps {
  /** Identifiant Jellyfin de l'épisode. Clé stable pour la mémoire de focus. */
  episodeId: string;
  /** L'épisode, pour ses actions à l'appui long. */
  episode: MediaItem;
  /** La ligne d'`apps/web`, rendue telle quelle. */
  children: ReactNode;
}

export function EpisodeRowTv({ episodeId, episode, children }: EpisodeRowTvProps) {
  const root = useRef<HTMLDivElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  useSheetFocusReturn(root, sheetOpen);

  /**
   * L'appui court rejoue un vrai clic sur la ligne enveloppée.
   *
   * `HTMLElement.click()` dispatche un `MouseEvent` que le système d'événements
   * de React récupère sur le `<div onClick>` de la ligne. On hérite ainsi de ce
   * qu'elle fait déjà — résolution de l'épisode, navigation vers le lecteur —
   * sans en dupliquer une ligne.
   */
  const shortAction = useCallback(() => {
    const line = root.current?.firstElementChild;
    if (line instanceof HTMLElement) line.click();
  }, []);

  const longAction = useCallback(() => setSheetOpen(true), []);

  const press = useMemo(
    () => createLongPress({ short: shortAction, long: longAction }),
    [shortAction, longAction],
  );

  return (
    <div
      ref={root}
      // `role="button"` et non `<button>` : ce dernier synthétise un `click` sur
      // Entrée, et l'action serait jouée deux fois.
      role="button"
      tabIndex={0}
      data-tv-carte
      data-tv-cle={episodeId}
      className="ligne-episode-tv"
      onKeyDown={press.onKeyDown}
      onKeyUp={press.onKeyUp}
      onBlur={press.onBlur}
    >
      {children}
      {sheetOpen && <CardActionSheetTv item={episode} variant="landscape" onClose={closeSheet} />}
    </div>
  );
}
