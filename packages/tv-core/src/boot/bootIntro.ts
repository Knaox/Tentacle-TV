/**
 * L'OUVERTURE au démarrage de la TV — quand la jouer, quand partir, quand
 * renoncer. Module pur : l'adaptateur (apps/tv `redesignWiring/boot/`) lui
 * donne ce qu'il sait, la règle tranche.
 *
 * Elle se joue À CHAQUE démarrage à froid d'une TV jumelée, D'ELLE-MÊME —
 * aucun geste, aucun appui n'est attendu (une app native n'a pas la règle
 * d'autolecture d'un navigateur) : le poulpe s'assemble pendant que l'app
 * charge, attend sur son bouton lecture tant que le PREMIER ÉCRAN n'est pas
 * prêt, puis « ta » (l'appui), « dum » (l'écran s'allume SUR ce premier écran)
 * et la plongée. Ce premier écran est l'accueil, ou « Qui regarde ? » sur une
 * TV passée aux profils de la Famille (chaque lancement y repasse, sauf un
 * profil retenu), ou une fenêtre du démarrage due (code PIN conseillé, barre,
 * photo). Régression payée (2026-10-18, « Chambre ») : réservée à l'accueil,
 * elle ne se jouait JAMAIS sur une TV à profils.
 *
 * Jamais : sur une plateforme qui ne l'a pas (le trait `brandIntro` : Android
 * TV garde sa mascotte), avec le mouvement réduit (le premier écran
 * directement), sans session (le jumelage), ni à la relance d'une lecture
 * interrompue (la fiche s'ouvre). Le retour d'arrière-plan n'est pas un
 * démarrage : rien ne se rejoue.
 */

/** Les premiers écrans où l'ouverture se joue (routes de la pile de la TV). */
export const BOOT_INTRO_ROUTES = ["Home", "Profiles", "PinSetup", "RailSetup", "PhotoSetup"] as const;

/**
 * Les écrans qui disent EUX-MÊMES quand ils sont prêts (leurs données
 * arrivent) ; les autres le sont dès qu'ils sont montés.
 */
export const BOOT_INTRO_SELF_REPORTING: readonly string[] = ["Home", "Profiles"];

const isIntroRoute = (route: string): boolean => (BOOT_INTRO_ROUTES as readonly string[]).includes(route);

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
  if (!input.supported || input.reducedMotion || input.interruptedPlayback) return "boot";
  return isIntroRoute(input.initialRoute) ? "intro" : "boot";
}

/**
 * Au-delà, le premier écran n'est toujours pas prêt : on plonge quand même,
 * dans l'écran qui dit lui-même qu'il charge — jamais une attente sans fin.
 */
export const BOOT_INTRO_MAX_HOLD_MS = 8_000;

/** Où en est un écran qui se dit prêt. */
export type BootScreenState = "loading" | "ready" | "failed";

/** Ce que l'adaptateur constate pendant l'ouverture. */
export interface BootIntroWatch {
  /** L'écran affiché (null : la navigation n'est pas encore prête). */
  route: string | null;
  /** Ce que cet écran dit de lui-même (null : rien encore). */
  screen: BootScreenState | null;
  /** Le voile hors ligne, la migration de la base, la page « accès suspendu » veulent paraître. */
  blocked: boolean;
  /** Depuis combien de temps l'ouverture attend sur le bouton lecture (0 : elle n'attend pas). */
  heldMs: number;
}

/**
 * `wait` : rester sur le bouton lecture ; `go` : appuyer (ta), allumer (dum),
 * plonger ; `abort` : renoncer — l'ouverture s'efface sur ce qui doit se voir
 * (hors ligne, migration, accès suspendu, écran en échec, jumelage), sans ta-dum.
 * Un premier écran qui en ouvre un autre (« Qui regarde ? » qui ouvre seul le
 * profil retenu, puis l'accueil) : l'ouverture suit, l'écran du poulpe montre
 * le dernier.
 */
export type BootIntroOutcome = "wait" | "go" | "abort";

export function bootIntroOutcome(watch: BootIntroWatch): BootIntroOutcome {
  if (watch.blocked) return "abort";
  if (watch.route === null) return "wait";
  if (!isIntroRoute(watch.route) || watch.screen === "failed") return "abort";
  const reports = BOOT_INTRO_SELF_REPORTING.includes(watch.route);
  if (!reports || watch.screen === "ready" || watch.heldMs >= BOOT_INTRO_MAX_HOLD_MS) return "go";
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
