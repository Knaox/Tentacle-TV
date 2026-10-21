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
 * Oui, sur les DEUX montages — mesuré le 21/10 sur une vraie lecture mpv HDR10
 * (macOS 26.6, M4) : en `fenetre` (Apple Silicon), le verre réfracte la fenêtre
 * Metal de mpv posée SOUS la nôtre ; en `gl` (Intel, forcé par
 * `TENTACLE_VIDEO_MONTAGE=gl`), il réfracte la `NSOpenGLView` de NOTRE fenêtre,
 * parce que la racine du verre se pose juste au-dessus d'elle
 * (`AppKitGlassBackend.anchor`). Le montage reste lu ici : un montage à venir
 * qui ne serait ni l'un ni l'autre ne serait pas annoncé par défaut.
 */
export function glassRefractsVideo(): boolean {
  if (liquidGlassAvailability() !== "native") return false;
  const montage = decideMacosMontage(process.arch, process.env);
  return montage === "fenetre" || montage === "gl";
}

/** Les arguments de fabrication que le preload relit (`protocol.ts`). */
export function liquidGlassArguments(): string[] {
  return [`${AVAILABILITY_ARG}${liquidGlassAvailability()}`, `${REFRACTS_VIDEO_ARG}${glassRefractsVideo() ? "1" : "0"}`];
}
