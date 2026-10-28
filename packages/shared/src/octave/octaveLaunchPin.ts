/**
 * Octave — « Ne pas demander le code PIN au démarrage » (le MOBILE, Damien, 28/10), la règle PURE de la porte
 * de « Qui regarde ? » (`octaveLaunchPin.test.ts`) : une app rouverte EN OCTAVE, réglage allumé, revient dans
 * l'identité qu'elle garde — la session de profil ouverte, sinon le compte — sans l'écran ni le code. « C'est
 * un lecteur de musique » : rouvrir le même profil n'est pas en changer, l'appareil en a déjà le jeton.
 *
 * Seule la SÉCURITÉ du serveur reste : la porte suit alors la règle du mobile « sans proposition d'office »
 * (`mobileProfileLaunch(…, asked = false)`) — le sélecteur ne vient que si le serveur dit l'appareil dans un
 * profil dont l'app n'a pas le jeton. Et une session de profil que le serveur a CLOSE (`request`) ramène
 * toujours « Qui regarde ? » : l'identité a changé, ce n'est plus « revenir où l'on était ». Rien ne change
 * côté serveur : la session de profil reste celle qu'il a posée.
 */

export interface OctaveLaunchPinInput {
  /** L'application s'ouvre dans Octave (le mode voulu au démarrage, Octave disponible). */
  inOctave: boolean;
  /** Le réglage de l'appareil (`octaveSkipLaunchPinOn`). */
  skipPin: boolean;
  /** Une session de profil a pris fin (le serveur l'a dit) : non-null. */
  request: string | null;
}

/** La porte doit-elle se passer de « Qui regarde ? » proposé d'office ? */
export function octaveLaunchSkipsPicker(input: OctaveLaunchPinInput): boolean {
  return input.inOctave && input.skipPin && input.request === null;
}

/** `asked` (l'administration propose l'écran d'office) vu par un lancement en Octave réglage allumé : non. */
export function octaveLaunchAsked(asked: boolean, input: OctaveLaunchPinInput): boolean {
  return octaveLaunchSkipsPicker(input) ? false : asked;
}
