/**
 * L'ouverture ne se joue QU'UNE FOIS dans la vie d'un processus : au
 * démarrage à froid de l'app, et jamais ensuite — ni après le choix du profil,
 * ni après le jumelage ou le code PIN, ni au retour d'arrière-plan, ni à un
 * changement de profil, ni à un rechargement de l'arbre React (le mode Lite
 * d'Android TV relance l'interface dans le même processus ; un rechargement du
 * JavaScript aussi). Règle pure : la MÉMOIRE du processus est passée en
 * entrée — l'adaptateur la tient hors du JavaScript (`TentacleBootSound.claimIntro` :
 * un drapeau natif, que rien ne recharge — TV et mobile).
 */

/** Ce qui demande à l'ouverture si elle doit se jouer. */
export type BootIntroTrigger =
  /** L'app se monte (`App`) : le démarrage à froid, OU un rechargement de l'arbre. */
  | "mount"
  | "foreground"
  | "profileChosen"
  | "profileSwitched"
  | "paired"
  | "pinEntered";

/** La mémoire du processus : l'ouverture y a-t-elle déjà été réclamée ? */
export interface BootIntroMemory {
  claimed: boolean;
}

export const FRESH_PROCESS: BootIntroMemory = { claimed: false };

export interface BootIntroTurn {
  /** Ce montage est le démarrage à froid : le premier du processus. */
  coldStart: boolean;
  memory: BootIntroMemory;
}

/**
 * Seul le PREMIER montage du processus est un démarrage à froid ; il réclame
 * l'ouverture (qu'elle se joue ou non : un mouvement réduit coupé ensuite ne
 * la rejoue pas). Tout le reste — un montage suivant, le retour d'arrière-plan,
 * un profil choisi ou changé, un jumelage, un code PIN — ne la joue jamais.
 */
export function bootIntroTurn(memory: BootIntroMemory, trigger: BootIntroTrigger): BootIntroTurn {
  if (trigger !== "mount" || memory.claimed) return { coldStart: false, memory };
  return { coldStart: true, memory: { claimed: true } };
}
