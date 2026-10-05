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
 * Android TV n'a pas toujours cet ordre : un élément qui prend le focus
 * AVANT d'être attaché (la préférence d'une entrée, posée à sa création)
 * l'annonce avant que la plateforme n'ait donné puis repris un focus de
 * passage ailleurs (le premier focalisable de la fenêtre) — prise du héros,
 * prise puis perte d'une entrée du rail. Le suivi retient donc les clés qui
 * ont annoncé leur prise sans leur perte (`held`, les plus récentes en
 * dernier) : quand la clé courante perd le focus alors qu'une autre le tient
 * encore, c'est celle-ci qui le porte. Sur tvOS, `held` n'a jamais plus d'une
 * clé : rien ne change.
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
  /** Les clés qui ont annoncé leur prise sans leur perte, les plus récentes en dernier. */
  readonly held: readonly string[];
}

export const EMPTY_FOCUS_TRACK: FocusTrack = Object.freeze({ current: null, last: null, held: Object.freeze([]) as readonly string[] });

/** Au plus autant de clés tenues : une perte jamais annoncée ne s'accumule pas. */
const MAX_HELD = 4;

/** Le suivi après la prise (`focused`) ou la perte du focus par `key`. */
export function trackFocus(track: FocusTrack, key: string, focused: boolean): FocusTrack {
  if (focused) {
    if (track.current === key && track.last === key && track.held[track.held.length - 1] === key) return track;
    const held = [...track.held.filter((k) => k !== key), key].slice(-MAX_HELD);
    return { current: key, last: key, held };
  }
  if (!track.held.includes(key) && track.current !== key) return track;
  const held = track.held.filter((k) => k !== key);
  if (track.current !== key) return { ...track, held };
  // La clé courante perd le focus : une autre qui l'a annoncé sans le perdre le porte encore.
  const still = held.length > 0 ? held[held.length - 1] : null;
  return still ? { current: still, last: still, held } : { current: null, last: track.last, held };
}
