import { AccessibilityInfo } from "react-native";
import type { StorageAdapter } from "@tentacle-tv/api-client";
import { decideBootIntro, type BootIntroPlan } from "@tentacle-tv/tv-core/boot";
import { readPlaybackMarker } from "@tentacle-tv/tv-core/playback";
import { PLATFORM_TRAITS } from "../../platform/traits";

/**
 * La décision de l'ouverture au démarrage (règle : tv-core `decideBootIntro`),
 * prise dès que le stockage est relu — avant les réglages, la langue et
 * l'accueil, que l'ouverture va justement camoufler. Une plateforme sans
 * ouverture (Android TV) décide aussitôt : la mascotte, comme avant.
 */
export const BOOT_PLAN_AT_START: BootIntroPlan | "pending" = PLATFORM_TRAITS.brandIntro ? "pending" : "boot";

// Demandé au chargement du module : la réponse est là quand on décide.
const reducedMotion: Promise<boolean> = PLATFORM_TRAITS.brandIntro
  ? AccessibilityInfo.isReduceMotionEnabled().catch(() => false)
  : Promise.resolve(true);

export async function bootPlanOf(storage: StorageAdapter, initialRoute: string): Promise<BootIntroPlan> {
  return decideBootIntro({
    supported: PLATFORM_TRAITS.brandIntro,
    reducedMotion: await reducedMotion,
    initialRoute,
    // Une lecture interrompue : la relance ouvre sa fiche sur l'accueil (`TVColdStartLanding`).
    interruptedPlayback: readPlaybackMarker(storage) !== null,
  });
}
