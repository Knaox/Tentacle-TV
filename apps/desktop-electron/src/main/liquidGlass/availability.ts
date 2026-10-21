/**
 * Le verre natif de macOS 26 est-il disponible ? La DÉCISION, sans Electron ni
 * AppKit.
 *
 * « Supporté » exige trois choses à la fois, et aucune ne se déduit des autres :
 *
 *  1. **macOS 26 ou plus.** `NSGlassEffectView` n'existe pas avant Tahoe.
 *  2. **La classe est là, à l'exécution.** C'est la seule preuve qui vaille : un
 *     numéro de version se lit de travers (voir `osSupportsGlass`), une classe
 *     absente ne se lit jamais présente.
 *  3. **Le pont Objective-C s'est chargé** (koffi, `video/objc.ts`). Sans lui,
 *     rien ne peut poser une vue.
 *
 * Le verdict est figé à la fabrication de la fenêtre et donné à la page par
 * argument (`additionalArguments`) : l'interrupteur de Réglages › Apparence ne
 * doit jamais apparaître PUIS disparaître.
 *
 * # Le forçage des bancs
 *
 * `TENTACLE_LIQUID_GLASS=off` simule un macOS sans verre : aucune vue native, et
 * le pont absent de la page — donc l'option invisible. `native` saute la seule
 * garde de version (un système qui se déclarerait mal) ; il ne fabrique jamais
 * une classe absente : sans elle, le verdict reste négatif.
 */

/** Ce que la coquille sait du verre natif — et, quand il manque, pourquoi. */
export type LiquidGlassAvailability =
  /** macOS 26+, `NSGlassEffectView` présente, pont Objective-C chargé. */
  | "native"
  /** Windows, Linux. */
  | "not-macos"
  /** `TENTACLE_LIQUID_GLASS=off` : un macOS sans verre, simulé. */
  | "forced-off"
  /** macOS d'avant 26. */
  | "unsupported-os"
  /** Version annoncée suffisante, mais la classe n'existe pas à l'exécution. */
  | "missing-class"
  /** Le pont koffi n'a pas pu se charger. */
  | "load-failed";

/** Ce que rend la sonde du runtime — elle n'est appelée que si tout le reste passe. */
export type RuntimeProbe = "ok" | "missing-class" | "load-failed";

export interface AvailabilityInput {
  /** `process.platform`. */
  readonly platform: string;
  /** `process.getSystemVersion()` — « 26.6.2 ». */
  readonly systemVersion: string;
  /** `TENTACLE_LIQUID_GLASS`. */
  readonly forced: string | undefined;
  /** Charge le pont et cherche la classe. Paresseuse : hors macOS, jamais appelée. */
  readonly probe: () => RuntimeProbe;
}

/**
 * macOS 26 et au-delà — et 16.x.
 *
 * ⚠️ 16 n'est pas une coquille. Comme Big Sur se disait « 10.16 » aux binaires
 * liés à un SDK plus ancien, Tahoe peut se présenter en « 16.0 » à un binaire
 * qui ne connaît pas encore le numéro 26. Aucun macOS 16 n'a jamais existé :
 * l'accepter ne laisse rien passer de faux, et la présence de la classe reste
 * la vraie garde.
 */
export function osSupportsGlass(systemVersion: string): boolean {
  const major = Number.parseInt(systemVersion.split(".")[0] ?? "", 10);
  if (!Number.isFinite(major)) return false;
  return major >= 26 || major === 16;
}

/** Le verdict — le forçage d'abord, puis la version, puis le runtime. */
export function decideLiquidGlass(input: AvailabilityInput): LiquidGlassAvailability {
  if (input.platform !== "darwin") return "not-macos";
  const forced = (input.forced ?? "").trim().toLowerCase();
  if (forced === "off") return "forced-off";
  if (forced !== "native" && !osSupportsGlass(input.systemVersion)) return "unsupported-os";
  const probed = input.probe();
  return probed === "ok" ? "native" : probed;
}
