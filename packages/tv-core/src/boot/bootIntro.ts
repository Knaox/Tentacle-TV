/**
 * L'OUVERTURE au démarrage de la TV — quand la jouer, quand partir, quand
 * renoncer. Module pur : l'adaptateur (apps/tv `redesignWiring/boot/`) lui
 * donne ce qu'il sait, la règle tranche.
 *
 * Elle REMPLACE la mascotte d'attente du démarrage À FROID qui mène à
 * l'accueil : le poulpe s'assemble pendant que l'app charge, attend sur son
 * bouton lecture tant que l'accueil n'est pas prêt, puis « ta » (l'appui),
 * « dum » (l'écran s'allume SUR l'accueil) et la plongée dans l'écran.
 *
 * Jamais : sur une plateforme qui ne l'a pas (le trait `brandIntro` : Android
 * TV garde sa mascotte), avec le mouvement réduit (l'accueil directement), ni
 * quand le démarrage ne mène pas à l'accueil — jumelage, « Qui regarde ? »
 * (profil et code PIN), une fenêtre du démarrage due (code PIN conseillé,
 * barre, photo), la relance d'une lecture interrompue (la fiche s'ouvre).
 * Le retour d'arrière-plan n'est pas un démarrage : rien ne se rejoue.
 */

export interface BootIntroInput {
  /** Le trait de la plateforme : l'ouverture y existe. */
  supported: boolean;
  /** Le réglage d'accessibilité « Réduire les animations ». */
  reducedMotion: boolean;
  /** La première route du démarrage (`initialRouteOf`). */
  initialRoute: string;
  /** Une lecture interrompue attend sa relance : la fiche va s'ouvrir sur l'accueil. */
  interruptedPlayback: boolean;
}

export type BootIntroPlan = "intro" | "boot";

export function decideBootIntro(input: BootIntroInput): BootIntroPlan {
  if (!input.supported || input.reducedMotion) return "boot";
  if (input.initialRoute !== "Home" || input.interruptedPlayback) return "boot";
  return "intro";
}

/**
 * Au-delà, l'accueil n'est toujours pas prêt : on plonge quand même, dans
 * l'accueil qui dit lui-même qu'il charge — jamais une attente sans fin.
 */
export const BOOT_INTRO_MAX_HOLD_MS = 8_000;

/** Ce que l'adaptateur constate pendant l'ouverture. */
export interface BootIntroWatch {
  /** L'accueil s'est montré d'un bloc (tv-core `homeLoading` faux) : héros et rangées en place. */
  homeReady: boolean;
  /** L'accueil n'a pas pu se charger (il le dit dans sa page). */
  homeFailed: boolean;
  /** Le voile hors ligne, la migration de la base, la page « accès suspendu » veulent paraître. */
  blocked: boolean;
  /** La navigation a quitté l'accueil (déjumelage, relance…). */
  leftHome: boolean;
  /** Depuis combien de temps l'ouverture attend sur le bouton lecture (0 : elle n'attend pas). */
  heldMs: number;
}

/**
 * `wait` : rester sur le bouton lecture ; `go` : appuyer (ta), allumer (dum),
 * plonger ; `abort` : renoncer — l'ouverture s'efface sur ce qui doit se voir
 * (hors ligne, migration, accès suspendu), sans ta-dum.
 */
export type BootIntroOutcome = "wait" | "go" | "abort";

export function bootIntroOutcome(watch: BootIntroWatch): BootIntroOutcome {
  if (watch.blocked || watch.leftHome || watch.homeFailed) return "abort";
  if (watch.homeReady || watch.heldMs >= BOOT_INTRO_MAX_HOLD_MS) return "go";
  return "wait";
}

/** Le renoncement : un rideau de l'encre du démarrage monte, puis découvre l'écran. */
export const BOOT_INTRO_ABORT = { coverMs: 160, revealMs: 280 } as const;

/** La reprise après l'attente : les boucles du scintillement s'éteignent en douceur. */
export const BOOT_INTRO_IDLE_FADE_MS = 150;

/**
 * Le démarrage SANS ouverture, sur une plateforme qui l'a : l'écran de
 * lancement est l'encre seule ; la mascotte d'attente n'y paraît que si le
 * démarrage traîne (sinon elle clignoterait une image avant l'écran suivant).
 */
export const BOOT_MASCOT_DELAY_MS = 400;
