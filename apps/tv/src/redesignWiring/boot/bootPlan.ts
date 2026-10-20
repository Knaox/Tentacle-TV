import { AccessibilityInfo } from "react-native";
import { bootIntroTurn, decideBootIntro, FRESH_PROCESS, type BootIntroMemory, type BootIntroPlan } from "@tentacle-tv/tv-core/boot";
import { bootSound } from "@tentacle-tv/brand-intro-native";
import { PLATFORM_TRAITS } from "../../platform/traits";

/**
 * La décision de l'ouverture au démarrage (règles : tv-core `decideBootIntro`,
 * `bootIntroTurn`), prise dès le montage de l'app — avant même le stockage :
 * elle ne dépend plus du premier écran (l'écran du poulpe s'allume sur
 * celui-là, quel qu'il soit). Une plateforme sans ouverture (sans le trait
 * `brandIntro`) décide aussitôt : la mascotte, comme avant.
 */
export const BOOT_PLAN_AT_START: BootIntroPlan | "pending" = PLATFORM_TRAITS.brandIntro ? "pending" : "boot";

// Demandé au chargement du module : la réponse est là quand on décide.
const reducedMotion: Promise<boolean> = PLATFORM_TRAITS.brandIntro
  ? AccessibilityInfo.isReduceMotionEnabled().catch(() => false)
  : Promise.resolve(true);

// La mémoire du processus, faute de module natif (un test, une app d'avant) : celle du JavaScript.
let jsMemory: BootIntroMemory = FRESH_PROCESS;

/**
 * Ce montage de l'app est-il le démarrage à froid du processus ? À appeler UNE
 * fois par montage : le premier réclame l'ouverture, tout montage suivant (un
 * rechargement de l'arbre) ne la rejoue jamais. La mémoire est NATIVE (un
 * rechargement du JavaScript ne l'efface pas), sinon celle du module.
 */
export function claimColdStart(): boolean {
  const nativeFirst = bootSound.claimIntro();
  const memory = nativeFirst === null ? jsMemory : { claimed: !nativeFirst };
  const turn = bootIntroTurn(memory, "mount");
  jsMemory = turn.memory;
  return turn.coldStart;
}

export async function bootPlanOf(coldStart: boolean): Promise<BootIntroPlan> {
  return decideBootIntro({ supported: PLATFORM_TRAITS.brandIntro, reducedMotion: await reducedMotion, coldStart });
}
