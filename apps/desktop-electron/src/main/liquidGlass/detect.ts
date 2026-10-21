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
 * Le lecteur pose-t-il son verre sur la vidéo ? Seulement au montage `fenetre`
 * (Apple Silicon : la fenêtre Metal de mpv, SOUS la nôtre).
 *
 * ⚠️ Le montage `gl` (Intel) le POURRAIT : mesuré le 21/10 sur une vraie lecture
 * mpv HDR10, le verre y réfracte la `NSOpenGLView` de notre fenêtre (la racine
 * se pose juste au-dessus, `AppKitGlassBackend.anchor`). Décision du lot : pas
 * de verre du lecteur sur Intel pour l'instant — ses GPU intégrés chauffent déjà
 * en lecture (`macosMontage.ts`, mpv#12675), un flou composé à chaque image
 * n'y arrangerait rien, et il n'y a aucun HDR à y gagner. Pour l'ouvrir, une
 * seule ligne : `|| montage === "gl"` ci-dessous.
 */
export function glassRefractsVideo(): boolean {
  if (liquidGlassAvailability() !== "native") return false;
  const montage = decideMacosMontage(process.arch, process.env);
  return montage === "fenetre";
}

/** Les arguments de fabrication que le preload relit (`protocol.ts`). */
export function liquidGlassArguments(): string[] {
  return [`${AVAILABILITY_ARG}${liquidGlassAvailability()}`, `${REFRACTS_VIDEO_ARG}${glassRefractsVideo() ? "1" : "0"}`];
}
