import { AccessibilityInfo } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FRESH_PROCESS, bootIntroTurn, type BootIntroMemory } from "@tentacle-tv/shared/brandIntro";
import { bootSound } from "@tentacle-tv/brand-intro-native";
import { readBootIntroSettings } from "./bootIntroSettings";
import { mobileBootPlan, type MobileBootPlan } from "./bootIntroRules";

/**
 * La décision de l'ouverture au démarrage du mobile, prise dès le montage de
 * l'app — avant même la relecture du stockage (règles : `mobileBootPlan`,
 * shared `bootIntroTurn`). Elle ne dépend pas du premier écran : l'écran du
 * poulpe s'allume sur celui-là, quel qu'il soit.
 */

// Demandés au chargement du module : les réponses sont là quand on décide.
const reducedMotion: Promise<boolean> = AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
const settings = readBootIntroSettings((key) => AsyncStorage.getItem(key));

// La mémoire du processus, faute de module natif (un binaire d'avant) : celle du JavaScript.
let jsMemory: BootIntroMemory = FRESH_PROCESS;

/**
 * Ce montage de l'app est-il le démarrage à froid du processus ? À appeler UNE
 * fois par montage : le premier réclame l'ouverture, tout montage suivant (un
 * rechargement de l'arbre ou du JavaScript, un retour d'arrière-plan qui
 * relance l'interface) ne la rejoue jamais. La mémoire est NATIVE
 * (`TentacleBootSound.claimIntro`), sinon celle du module.
 */
export function claimColdStart(): boolean {
  const nativeFirst = bootSound.claimIntro();
  const memory = nativeFirst === null ? jsMemory : { claimed: !nativeFirst };
  const turn = bootIntroTurn(memory, "mount");
  jsMemory = turn.memory;
  return turn.coldStart;
}

async function bootPlanOf(coldStart: boolean): Promise<MobileBootPlan> {
  const [motion, stored] = await Promise.all([reducedMotion, settings]);
  return mobileBootPlan({ coldStart, reducedMotion: motion, settings: stored });
}

let decision: Promise<MobileBootPlan> | null = null;

/**
 * LA décision de ce chargement du JavaScript, prise une fois (le mode strict
 * de React rejoue les initialisations : la mémoire du processus ne doit être
 * réclamée qu'une fois). La racine l'attend avec le stockage : la navigation
 * n'est jamais montée avant qu'on sache si l'app vit dans l'écran du poulpe.
 */
export function bootDecision(): Promise<MobileBootPlan> {
  decision ??= bootPlanOf(claimColdStart());
  return decision;
}
