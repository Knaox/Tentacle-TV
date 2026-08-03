import { PALIERS } from "./machineScrub";

/**
 * Distinguer l'appui simple du maintien, à partir de la seule répétition.
 *
 * `appuiLong.ts` répond déjà à cette question pour OK, mais à sa manière : il
 * déclenche une action AU SEUIL, une fois. Ici il faut autre chose — une
 * cadence, qui monte tant qu'on tient et retombe dès qu'on lâche. Les deux
 * partagent le même constat de terrain : **le relâchement n'est pas garanti**
 * sur toutes les dalles, donc on le déduit du silence.
 *
 * Le palier monte tous les `REPETITIONS_PAR_PALIER` appuis consécutifs. Six,
 * soit un peu plus d'une seconde de maintien à la cadence habituelle : assez
 * pour que l'accélération se sente sans qu'elle surprenne.
 */

/** Au-delà, la touche est considérée relâchée. Même valeur qu'`appuiLong.ts`. */
const SILENCE_MS = 700;

const REPETITIONS_PAR_PALIER = 6;

export interface Cadence {
  /** Rend le multiplicateur de palier pour cet appui. */
  mesurer: (code: number, maintenant: number) => number;
  relacher: () => void;
}

export function creerCadence(): Cadence {
  let dernierCode = 0;
  let dernierInstant = 0;
  let repetitions = 0;

  function relacher(): void {
    dernierCode = 0;
    dernierInstant = 0;
    repetitions = 0;
  }

  function mesurer(code: number, maintenant: number): number {
    const memeTouche = code === dernierCode;
    const enchaine = memeTouche && maintenant - dernierInstant <= SILENCE_MS;

    repetitions = enchaine ? repetitions + 1 : 0;
    dernierCode = code;
    dernierInstant = maintenant;

    const rang = Math.min(Math.floor(repetitions / REPETITIONS_PAR_PALIER), PALIERS.length - 1);
    return PALIERS[rang];
  }

  return { mesurer, relacher };
}
