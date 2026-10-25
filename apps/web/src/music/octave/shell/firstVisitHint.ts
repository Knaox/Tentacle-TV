/**
 * Octave — le repère de la PREMIÈRE visite : « Octave, le mode musique de
 * Tentacle — pour revenir aux films et séries, c'est ici », posé sous la
 * bascule. Une fois par APPAREIL (stockage local), jamais par-dessus un autre
 * recouvrement : il attend que les fenêtres du démarrage de Tentacle se soient
 * tues (`useStartupQuiet`) et qu'aucune feuille modale ne soit ouverte
 * (feuille du code PIN, « en cours », choix d'une playlist…). Règle pure,
 * stockage à part (`firstVisitHint.test.ts`).
 *
 * ⚠️ Clé traversée par une chaîne : jamais renommée.
 */

export const FIRST_VISIT_HINT_KEY = "tentacle_octave_intro_seen";

/** Le court répit avant de paraître : la coquille posée, l'œil arrivé. */
export const FIRST_VISIT_HINT_DELAY_MS = 900;

export interface FirstVisitInput {
  seen: boolean;
  /** Les fenêtres du démarrage de Tentacle sont toutes tues. */
  startupQuiet: boolean;
  /** Une feuille modale est ouverte (`[aria-modal="true"]`) ou la coquille couvre la page. */
  overlayOpen: boolean;
}

export function firstVisitHintDue({ seen, startupQuiet, overlayOpen }: FirstVisitInput): boolean {
  return !seen && startupQuiet && !overlayOpen;
}

export function readFirstVisitSeen(storage: Pick<Storage, "getItem"> | null): boolean {
  try {
    // Sans stockage lisible : vu — mieux vaut ne rien montrer que le montrer à chaque fois.
    return storage === null || storage.getItem(FIRST_VISIT_HINT_KEY) === "1";
  } catch {
    return true;
  }
}

export function markFirstVisitSeen(storage: Pick<Storage, "setItem"> | null): void {
  try {
    storage?.setItem(FIRST_VISIT_HINT_KEY, "1");
  } catch {
    /* stockage indisponible : le repère ne reviendra pas pour autant dans cette session */
  }
}

/** Le stockage de l'appareil, s'il existe (rendu à plat, navigateur bridé). */
export function deviceStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
