/**
 * Le SUIVI du focus d'un écran : la clé qui le porte, celle qui l'avait en
 * dernier — tiré des seuls événements de prise et de perte, clé par clé.
 *
 * La plateforme annonce, pour chaque élément lié, sa prise et sa perte du
 * focus (tvOS : le flou de l'ancien AVANT le focus du nouveau). Une perte ne
 * vide le suivi que si elle concerne la clé qui le portait : un flou en
 * retard — un élément démonté qui annonce lui-même sa perte — n'efface pas un
 * focus posé ailleurs entre-temps. La dernière clé reste après la perte :
 * c'est elle qu'on rend au retour, elle que visent les guides.
 *
 * Aucune clé portée (`current` nul) ne veut pas dire « pas de focus » : il
 * peut être hors de l'écran — dans une `Modal`, dans un autre magasin.
 *
 * Module pur : ni React, ni React Native.
 */

export interface FocusTrack {
  /** La clé qui porte le focus, ou `null` : aucune des clés suivies. */
  readonly current: string | null;
  /** La dernière clé focalisée — elle reste après la perte du focus. */
  readonly last: string | null;
}

export const EMPTY_FOCUS_TRACK: FocusTrack = Object.freeze({ current: null, last: null });

/** Le suivi après la prise (`focused`) ou la perte du focus par `key`. */
export function trackFocus(track: FocusTrack, key: string, focused: boolean): FocusTrack {
  if (focused) return track.current === key && track.last === key ? track : { current: key, last: key };
  return track.current === key ? { current: null, last: track.last } : track;
}
