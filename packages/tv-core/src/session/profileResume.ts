import { sameUserId, type TvProfileDto } from "@tentacle-tv/shared";
import { isProfileLocked } from "./profileLaunch";
import type { ProfileLaunch } from "./tvProfileSession";

/**
 * « Changer de profil » puis le MÊME profil : il se rouvre sans son PIN.
 *
 * Quitter un profil révoque sa session — le rouvrir repasse par le serveur, et
 * par le PIN. Mais « Changer de profil » n'est pas encore quitter : tant que «
 * Qui regarde ? » est à l'écran, la session est GARDÉE (sa révocation attend,
 * `beginProfileLeave` avec `holdUntil`) ; choisir de nouveau ce profil la
 * reprend (`reclaimRevocation`) au lieu d'en ouvrir une autre. Rien de plus
 * qu'avant n'est permis : la TV avait cette session ouverte l'instant d'avant,
 * et quiconque était devant pouvait la garder en appuyant sur Retour.
 *
 * Elle ne se garde qu'en mémoire (jamais au démarrage suivant : relancer l'app
 * ne contourne jamais un PIN), `PROFILE_RESUME_HOLD_MS` au plus, et cède dès
 * qu'un AUTRE profil s'ouvre (le serveur ferme l'ancienne session). Elle ne
 * sert pas quand « Ne plus proposer à l'ouverture » est coché : retenir un
 * profil est un geste que le serveur doit voir.
 */

/** Le temps qu'une session quittée par « Changer de profil » reste reprenable. */
export const PROFILE_RESUME_HOLD_MS = 10 * 60_000;

export interface HeldProfileSession {
  profileId: string;
  token: string;
  /** Comment ce profil s'était ouvert : il le garde en reprenant. */
  launch: ProfileLaunch;
  /** Reprenable jusqu'à ce moment (ms). */
  until: number;
}

/** OK sur ce profil reprend-il la session gardée (sans PIN, sans appel au serveur) ? */
export function resumesHeldSession(
  held: HeldProfileSession | null,
  profile: Pick<TvProfileDto, "userId" | "lockedUntil">,
  remember: boolean,
  now: number,
): boolean {
  if (!held || remember || now >= held.until) return false;
  if (isProfileLocked(profile, now)) return false;
  return sameUserId(held.profileId, profile.userId);
}
