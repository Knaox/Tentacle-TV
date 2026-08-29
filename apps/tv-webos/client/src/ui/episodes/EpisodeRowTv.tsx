import { useCallback, useMemo, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { createLongPress } from "../../focus/longPress";

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
 * **Appui court, appui long.** Bref lance l'épisode ; maintenu ouvre sa fiche.
 * C'est la convention d'Apple TV, celle que le geste rend naturelle, et c'est
 * déjà celle des cartes d'épisode de l'accueil.
 *
 * `data-tv-cle` porte l'identifiant Jellyfin : c'est ce qui permet à la mémoire
 * de focus de retrouver CET épisode au retour du lecteur, là où un libellé
 * traduit ou une position dans la liste ne le garantiraient pas.
 */

interface EpisodeRowTvProps {
  /** Identifiant Jellyfin de l'épisode. Clé stable pour la mémoire de focus. */
  episodeId: string;
  /** La ligne d'`apps/web`, rendue telle quelle. */
  children: ReactNode;
}

export function EpisodeRowTv({ episodeId, children }: EpisodeRowTvProps) {
  const root = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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

  const longAction = useCallback(() => {
    navigate(`/media/${episodeId}`);
  }, [episodeId, navigate]);

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
    </div>
  );
}
