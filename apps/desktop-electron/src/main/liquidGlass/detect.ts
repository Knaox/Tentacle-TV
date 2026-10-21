/**
 * Le verdict du verre natif pour CE processus, et ce que la page en reçoit à la
 * fabrication de la fenêtre.
 *
 * La décision est dans `availability.ts` (pure, testée) ; ici, ses entrées
 * réelles. Le pont Objective-C n'est chargé que sur macOS, et seulement si le
 * forçage et la version ne l'ont pas déjà écarté : `objc.ts` charge le runtime
 * À L'IMPORT, et l'importer ailleurs ferait tomber le processus.
 */

import { decideLiquidGlass, type LiquidGlassAvailability, type RuntimeProbe } from "./availability";
import { decideMacosMontage } from "../video/macosMontage";
import { AVAILABILITY_ARG, REFRACTS_VIDEO_ARG } from "./protocol";

let verdict: LiquidGlassAvailability | null = null;

/** Charge le pont et cherche les deux classes publiques dont le verre a besoin. */
function probeRuntime(): RuntimeProbe {
  try {
    const { cls } = require("../video/objc") as typeof import("../video/objc");
    const present = cls("NSGlassEffectView") !== null && cls("NSGlassEffectContainerView") !== null;
    return present ? "ok" : "missing-class";
  } catch {
    return "load-failed";
  }
}

/** Le verdict, établi une fois — le système ne change pas de version en cours de route. */
export function liquidGlassAvailability(): LiquidGlassAvailability {
  if (verdict !== null) return verdict;
  verdict = decideLiquidGlass({
    platform: process.platform,
    systemVersion: process.getSystemVersion(),
    forced: process.env["TENTACLE_LIQUID_GLASS"],
    probe: probeRuntime,
  });
  // Une ligne au démarrage : « pourquoi n'ai-je pas le verre ? » se lit ici.
  if (process.platform === "darwin") console.info(`[liquid-glass] ${verdict}`);
  return verdict;
}

/**
 * Le verre voit-il la vidéo posée sous la page ?
 *
 * Mesuré sur le montage `fenetre` (Apple Silicon : la fenêtre Metal de mpv est
 * SOUS la nôtre, et le verre réfracte ce qui est sous la fenêtre). Le montage
 * `gl` (Intel) dessine DANS la fenêtre, sous la racine du verre : à confirmer
 * sur une vraie lecture avant de l'annoncer — d'ici là, la page garde le rendu
 * d'avant sur la vidéo.
 */
export function glassRefractsVideo(): boolean {
  return liquidGlassAvailability() === "native" && decideMacosMontage(process.arch, process.env) === "fenetre";
}

/** Les arguments de fabrication que le preload relit (`protocol.ts`). */
export function liquidGlassArguments(): string[] {
  return [`${AVAILABILITY_ARG}${liquidGlassAvailability()}`, `${REFRACTS_VIDEO_ARG}${glassRefractsVideo() ? "1" : "0"}`];
}
