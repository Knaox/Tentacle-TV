/**
 * Faut-il montrer la pilule « Passer l'intro », et compter avant de sauter ?
 *
 * # Pourquoi un réducteur pur plutôt qu'un hook
 *
 * Trois questions se croisent ici — la préférence est-elle active, où en est la
 * lecture, l'utilisateur s'est-il opposé — et deux défauts d'usage sont nés de
 * ce croisement. Le dépôt a déjà sa réponse pour ce genre de logique :
 * `seekLanding.ts`, un réducteur sans horloge ni React, que son banc peut
 * dérouler seconde par seconde. Rien ici n'a besoin d'un DOM pour être vérifié,
 * et il n'existe de toute façon aucun outil pour rendre un hook dans les tests.
 *
 * # Les deux défauts que cette machine corrige
 *
 * 1. **Le refus ne se laissait pas défaire.** Il était mémorisé pour l'épisode.
 *    Or on peut traverser une intro plusieurs fois : revenir dedans doit
 *    redonner sa chance au saut automatique. Le refus vaut donc pour LE PASSAGE
 *    en cours, pas pour l'épisode — c'est déjà ce que fait le téléviseur
 *    (`TVSkipSegmentButton`, « reset dismissed when segment goes out of range »).
 *
 * 2. **La pilule survivait au saut.** Elle réapparaissait quelques secondes sous
 *    son libellé manuel, parce que la position de lecture met du temps à
 *    rattraper : elle n'est échantillonnée qu'à 1 Hz, et un saut HLS peut
 *    demander plusieurs secondes avant d'aboutir. L'état `saute` masque la
 *    pilule pendant ce trajet — le saut a été demandé, le redire n'apporte rien.
 */

/**
 * Trois secondes : le temps de voir la pilule et de s'y opposer. C'est le
 * DÉFAUT — le délai réel vient du réglage utilisateur (`autoDelayMs`), passé
 * à chaque entrée de cadre.
 */
export const SKIP_DELAY_DEFAULT_MS = 3_000;

/** Façade en secondes — la glissière CSS des boutons lit encore ce nom. */
export const INTRO_SKIP_START_SECONDS = SKIP_DELAY_DEFAULT_MS / 1000;

/**
 * Au-delà, on rend le bouton manuel. Un saut peut échouer — réseau coupé,
 * session de transcodage à refaire — et l'utilisateur ne doit pas rester devant
 * une intro sans aucun moyen de la passer.
 */
export const SKIP_GUARD_MS = 10_000;

export type IntroSkipState =
  | { name: "repos" }
  | { name: "decompte"; remainingMs: number }
  | { name: "refuse" }
  | { name: "saute"; sinceMs: number };

export type IntroSkipInput =
  | {
      type: "cadre";
      visible: boolean;
      active: boolean;
      /** Temps écoulé depuis le cadre précédent — 1000 ms sur web/TV, 250 ms
       *  sur mobile : le décompte est en ms précisément pour absorber les
       *  deux cadences sans en privilégier une. */
      elapsedMs: number;
      /** Délai avant le saut automatique. Défaut : SKIP_DELAY_DEFAULT_MS. */
      delayMs?: number;
    }
  | { type: "croix" }
  | { type: "sauteMaintenant" };

/** Ce que l'appelant doit faire, en plus de retenir le nouvel état. */
export type IntroSkipAction = "rien" | "sauter";

export const INTRO_SKIP_IDLE: IntroSkipState = { name: "repos" };

/**
 * `visible` est la fenêtre d'intro telle que le lecteur la calcule déjà. Son
 * front MONTANT réarme : c'est là, et nulle part ailleurs, que le refus tombe.
 */
export function decideIntroSkip(
  state: IntroSkipState,
  input: IntroSkipInput,
  previousVisible: boolean,
): [IntroSkipState, IntroSkipAction] {
  if (input.type === "croix") return [{ name: "refuse" }, "rien"];
  if (input.type === "sauteMaintenant") return [{ name: "saute", sinceMs: 0 }, "sauter"];

  const { visible, active, elapsedMs } = input;

  // Sortie de l'intro : tout retombe, y compris un saut en vol — la position a
  // rattrapé, c'est précisément ce que le saut attendait.
  if (!visible) return [INTRO_SKIP_IDLE, "rien"];

  const delayMs = input.delayMs ?? SKIP_DELAY_DEFAULT_MS;

  // Entrée dans l'intro. Le refus d'un passage précédent ne la suit pas.
  if (!previousVisible) {
    return active ? [{ name: "decompte", remainingMs: delayMs }, "rien"] : [INTRO_SKIP_IDLE, "rien"];
  }

  if (state.name === "saute") {
    const sinceMs = state.sinceMs + elapsedMs;
    // Le saut n'a jamais abouti : on rend le bouton manuel plutôt que de laisser
    // l'utilisateur devant une intro qu'il ne peut plus passer.
    return sinceMs >= SKIP_GUARD_MS ? [INTRO_SKIP_IDLE, "rien"] : [{ name: "saute", sinceMs }, "rien"];
  }

  if (state.name === "refuse") return [state, "rien"];

  // La préférence peut s'éteindre pendant le décompte : il s'arrête, la pilule
  // reste, et elle redevient ce qu'elle était — un bouton.
  if (!active) return [INTRO_SKIP_IDLE, "rien"];

  if (state.name === "repos") return [{ name: "decompte", remainingMs: delayMs }, "rien"];

  // `elapsedMs` nul = simple réévaluation (la préférence vient de changer, par
  // exemple), pas un battement d'horloge : le décompte ne doit pas y perdre
  // de temps.
  if (elapsedMs <= 0) return [state, "rien"];

  const remainingMs = state.remainingMs - elapsedMs;
  return remainingMs <= 0
    ? [{ name: "saute", sinceMs: 0 }, "sauter"]
    : [{ name: "decompte", remainingMs }, "rien"];
}

/** La pilule se rend-elle ? Pendant un saut, non : il a déjà été demandé. */
export const showSkipPill = (state: IntroSkipState, visible: boolean): boolean =>
  visible && state.name !== "saute";

/** Secondes affichées, `null` quand la pilule est un simple bouton. */
export const displayedCountdown = (state: IntroSkipState): number | null =>
  state.name === "decompte" ? Math.max(1, Math.ceil(state.remainingMs / 1000)) : null;
