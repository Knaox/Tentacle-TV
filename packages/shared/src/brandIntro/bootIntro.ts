/**
 * L'OUVERTURE au démarrage (Apple TV, Android TV, mobile, iPad) — quand la
 * jouer, quand partir. Module pur : l'adaptateur (apps/tv
 * `redesignWiring/boot/`, apps/mobile `src/bootIntro/`) lui donne ce qu'il
 * sait, la règle tranche.
 *
 * Elle se joue à CHAQUE démarrage à froid, D'ELLE-MÊME — aucun geste, aucun
 * appui n'est attendu (une app native n'a pas la règle d'autolecture d'un
 * navigateur) —, QUEL QUE SOIT LE PREMIER ÉCRAN : l'accueil, « Qui regarde ? »
 * (et son code PIN), le jumelage d'une app neuve, la préconfiguration de la
 * barre, le code PIN conseillé, la photo, un écran hors ligne, la migration de
 * la base, « accès suspendu ». Le poulpe s'assemble pendant que l'app charge,
 * attend sur son bouton lecture tant que ce premier écran n'est pas prêt, puis
 * « ta » (l'appui), « dum » (l'écran s'allume SUR cet écran-là) et la plongée
 * dedans. Une seule fois par processus (`bootIntroOnce`). Décision de Damien
 * du 2026-10-18, après « Chambre » : réservée à l'accueil, elle ne se jouait
 * jamais sur sa TV passée aux profils.
 *
 * Jamais : sur une plateforme qui ne l'a pas (le trait `brandIntro` de la
 * TV), ni avec le mouvement réduit (réglage d'accessibilité : le premier
 * écran directement), ni quand l'appareil l'a coupée (réglage du mobile
 * « Animation d'ouverture »).
 */

export interface BootIntroInput {
  /** Le trait de la plateforme : l'ouverture y existe. */
  supported: boolean;
  /** Le réglage d'accessibilité « Réduire les animations ». */
  reducedMotion: boolean;
  /** Ce montage est le démarrage à froid du processus (`bootIntroTurn`). */
  coldStart: boolean;
  /** Le réglage d'appareil « Animation d'ouverture » (mobile ; absent : allumée). */
  enabled?: boolean;
}

export type BootIntroPlan = "intro" | "boot";

export function decideBootIntro(input: BootIntroInput): BootIntroPlan {
  return input.supported && input.enabled !== false && !input.reducedMotion && input.coldStart ? "intro" : "boot";
}

/**
 * Les écrans de la TV qui disent EUX-MÊMES quand ils sont prêts (leurs
 * données arrivent) ; les autres le sont dès qu'ils sont montés. Le mobile a
 * les siens (`BootIntroWatch.selfReporting`).
 */
export const BOOT_INTRO_SELF_REPORTING: readonly string[] = ["Home", "Profiles"];

/**
 * Au-delà, le premier écran n'est toujours pas prêt : on plonge quand même,
 * dans l'écran qui dit lui-même qu'il charge — jamais une attente sans fin.
 */
export const BOOT_INTRO_MAX_HOLD_MS = 8_000;

/** Où en est un écran qui se dit prêt. */
export type BootScreenState = "loading" | "ready" | "failed";

/** Ce que l'adaptateur constate pendant l'ouverture. */
export interface BootIntroWatch {
  /** L'écran affiché (null : l'app n'est pas encore montée). */
  route: string | null;
  /** Ce que cet écran dit de lui-même (null : rien encore). */
  screen: BootScreenState | null;
  /** Un voile ou une page qui recouvre tout (hors ligne, migration, accès suspendu) est là : c'est lui qu'on montre. */
  blocked: boolean;
  /** Depuis combien de temps l'ouverture attend sur le bouton lecture (0 : elle n'attend pas). */
  heldMs: number;
  /** Les écrans qui disent eux-mêmes quand ils sont prêts (défaut : ceux de la TV). */
  selfReporting?: readonly string[];
}

/**
 * `wait` : rester sur le bouton lecture ; `go` : appuyer (ta), allumer (dum),
 * plonger. Elle ne renonce jamais : l'écran du poulpe s'allume sur ce qui est
 * là — un écran en échec, hors ligne ou bloqué compris, qui dit lui-même ce
 * qu'il en est. Un premier écran qui en ouvre un autre (« Qui regarde ? » qui
 * ouvre seul le profil retenu, puis l'accueil ; la relance d'une lecture qui
 * ouvre sa fiche) : l'ouverture suit, l'écran du poulpe montre le dernier.
 */
export type BootIntroOutcome = "wait" | "go";

export function bootIntroOutcome(watch: BootIntroWatch): BootIntroOutcome {
  if (watch.route === null) return "wait";
  if (watch.blocked || watch.screen === "ready" || watch.screen === "failed") return "go";
  const selfReporting = watch.selfReporting ?? BOOT_INTRO_SELF_REPORTING;
  if (!selfReporting.includes(watch.route) || watch.heldMs >= BOOT_INTRO_MAX_HOLD_MS) return "go";
  return "wait";
}

/** La reprise après l'attente : les boucles du scintillement s'éteignent en douceur. */
export const BOOT_INTRO_IDLE_FADE_MS = 150;

/**
 * Le démarrage SANS ouverture, sur une plateforme qui l'a : l'écran de
 * lancement est l'encre seule ; la mascotte d'attente n'y paraît que si le
 * démarrage traîne (sinon elle clignoterait une image avant l'écran suivant).
 */
export const BOOT_MASCOT_DELAY_MS = 400;
