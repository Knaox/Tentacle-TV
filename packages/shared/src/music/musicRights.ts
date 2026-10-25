/**
 * Octave — les DROITS d'un compte face à l'extension de musique (route `rights` du contrat `music`,
 * docs/octave/CONTRATS.md). C'est l'EXTENSION qui les règle (son administration) et qui les TIENT (ses routes
 * refusent) ; le client ne fait que cacher ce qui serait refusé.
 *
 * Extension d'avant (pas de route `rights`) : tout comme avant — l'ajout reste proposé, aucune limite n'est
 * dite, rien n'est gardé hors ligne hors bibliothèque (`MUSIC_RIGHTS_BEFORE`).
 */

export interface MusicRights {
  /** Peut faire entrer des titres dans la bibliothèque (« J'aime », ajout à une playlist d'un titre hors bibliothèque). */
  acquire: boolean;
  /** Ajouts permis par jour ; 0 = sans limite. */
  dailyLimit: number;
  /** Ajouts qui restent aujourd'hui ; `null` = sans limite (ou pas le droit d'ajouter). */
  remainingToday: number | null;
  /** Peut garder hors ligne (sur l'appareil) les titres HORS bibliothèque, dont l'extension fournit la source. */
  keepOffline: boolean;
  /** Prochaine remise à zéro du compteur (ms UTC : minuit à l'heure du serveur) ; `null` sans limite. */
  resetsAt: number | null;
}

/** Ce que vaut une extension qui ne déclare pas `rights` : le comportement d'avant. */
export const MUSIC_RIGHTS_BEFORE: MusicRights = { acquire: true, dailyLimit: 0, remainingToday: null, keepOffline: false, resetsAt: null };

const count = (value: unknown, max: number): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max ? value : null;

/** La réponse de `rights`, validée ; `null` si elle n'a pas la forme (le client garde alors le comportement d'avant). */
export function readMusicRights(raw: unknown): MusicRights | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const dailyLimit = count(r.dailyLimit, 100_000);
  if (typeof r.acquire !== "boolean" || typeof r.keepOffline !== "boolean" || dailyLimit === null) return null;
  const remainingToday = r.remainingToday === null ? null : count(r.remainingToday, 100_000);
  if (remainingToday === null && r.remainingToday !== null) return null;
  const resetsAt = typeof r.resetsAt === "number" && Number.isFinite(r.resetsAt) && r.resetsAt > 0 ? r.resetsAt : null;
  return { acquire: r.acquire, dailyLimit, remainingToday, keepOffline: r.keepOffline, resetsAt };
}
