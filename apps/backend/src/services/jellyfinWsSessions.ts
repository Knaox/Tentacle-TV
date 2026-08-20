/**
 * Ce qui, dans une trame `Sessions` de Jellyfin, mérite de réveiller la maison.
 *
 * La trame pèse ~20 Ko et arrive à chaque progression de lecture — une
 * quinzaine de fois par minute dès que deux personnes regardent quelque chose.
 * La position y bouge en permanence : diffuser à chaque trame ferait re-piocher
 * tous les clients connectés dix-huit fois par minute pour rien.
 *
 * On ne compare donc que ce qui change l'affichage :
 *
 *  - `lectures` — qui lit quoi. C'est ce qui déplace « Reprendre » et
 *    « Prochains épisodes » sur les autres appareils.
 *  - `etats` — la même chose, pause comprise. Une pause ne change aucune liste,
 *    mais elle borne un segment de temps de visionnage : elle vaut un relevé,
 *    pas une diffusion.
 */

export interface SessionJellyfin {
  UserId?: string | null;
  NowPlayingItem?: { Id?: string | null } | null;
  PlayState?: { IsPaused?: boolean | null } | null;
}

export interface SignaturesSessions {
  /** Jeu des lectures en cours — change ⇒ les listes des clients ont bougé. */
  lectures: string;
  /** Idem, pause comprise — change ⇒ le collecteur de temps a un bord à poser. */
  etats: string;
}

/** Deux signatures stables (triées) tirées d'une seule passe sur les sessions. */
export function signaturesSessions(
  sessions: readonly SessionJellyfin[] | null | undefined,
): SignaturesSessions {
  if (!Array.isArray(sessions)) return { lectures: "", etats: "" };

  const lectures: string[] = [];
  const etats: string[] = [];
  for (const s of sessions) {
    const itemId = s?.NowPlayingItem?.Id;
    if (!itemId) continue; // Session ouverte sans lecture : invisible pour nous.
    const cle = `${s.UserId ?? "?"}:${itemId}`;
    lectures.push(cle);
    etats.push(`${cle}:${s.PlayState?.IsPaused ? "pause" : "lecture"}`);
  }
  // Jellyfin ne garantit pas l'ordre des sessions d'une trame à l'autre : sans
  // tri, deux trames identiques passeraient pour un changement.
  return { lectures: lectures.sort().join("|"), etats: etats.sort().join("|") };
}
