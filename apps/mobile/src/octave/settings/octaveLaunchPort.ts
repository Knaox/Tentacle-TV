/**
 * Octave (mobile) — le PORT par lequel la coquille d'Octave (m1-coquille, démarrage instantané) dit à la porte
 * de « Qui regarde ? » si CE démarrage à froid s'ouvre dans Octave. Décidé une fois par processus, au montage :
 * la porte ne le relit que pour sa décision d'ouverture. Sans fournisseur : non (le comportement d'avant).
 */

let read: () => boolean = () => false;

/** La coquille d'Octave branche sa décision (« le lancement se fait dans Octave »). */
export function provideOctaveLaunch(launchedInOctave: () => boolean): void {
  read = launchedInOctave;
}

export function launchedInOctave(): boolean {
  try {
    return read();
  } catch {
    return false;
  }
}
