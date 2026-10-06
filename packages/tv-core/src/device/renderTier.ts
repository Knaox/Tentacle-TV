import { allCoresWeak, describeCores, type CoreId } from "./cpuCores";

/**
 * Le NIVEAU DE RENDU de l'appareil : `normal` (la refonte telle quelle) ou
 * `lite` (mêmes écrans, mêmes gestes, des effets sobres — chantier « Mode
 * Lite » d'Android TV). Une règle pure : des signaux en entrée, un niveau et
 * SA RAISON en sortie, jamais un `Platform.OS`.
 *
 * C'est un TRAIT : l'Apple TV vaut toujours `normal` (`platform: "tvos"`),
 * quoi qu'on lui donne — elle ne voit rien de ce chantier.
 *
 * Quand la décision se prend (décisions de Damien, 07/10) : les signaux
 * matériels sont lus AVANT la première image (le premier écran est déjà dans
 * le bon mode) ; le micro-test tourne après, une fois, et son verdict ne vaut
 * qu'au lancement SUIVANT. Il ne peut que faire passer en Lite, jamais
 * l'inverse : un appareil que les signaux disent faible le reste.
 */

export type RenderTier = "normal" | "lite";

/** Le réglage de l'utilisateur : « Automatique », « Activé », « Désactivé ». */
export type RenderTierMode = "auto" | "on" | "off";

export const RENDER_TIER_MODES: readonly RenderTierMode[] = ["auto", "on", "off"];

export type TierPlatform = "tvos" | "androidtv";

/** Ce que l'appareil dit de lui (module natif `TentacleDevice`). Tout est facultatif : un signal illisible se tait. */
export interface DeviceSignals {
  /** `ActivityManager.isLowRamDevice()` : le fabricant déclare l'appareil à mémoire limitée. */
  lowRamDevice?: boolean;
  /** La mémoire totale vue par le système (`MemoryInfo.totalMem`), en Mio — un peu sous la capacité nominale. */
  totalRamMb?: number;
  /** `getMemoryClass()` : le tas Java permis à l'app, en Mio. Journaux seulement. */
  memoryClassMb?: number;
  /** Le nombre de cœurs de l'appareil (`/sys/devices/system/cpu/possible`). */
  coreCount?: number;
  /** La fréquence maximale du cœur le plus rapide, en MHz. Journaux seulement. */
  maxFreqMhz?: number;
  /** L'identité de CHAQUE cœur lu (`0x41:0xd03`) — voir `cpuCores`. */
  coreIds?: readonly CoreId[];
  /** Le SoC (`Build.SOC_MODEL` dès l'API 31, sinon `ro.board.platform`). Journaux seulement. */
  soc?: string;
  /** La version d'Android (API). Journaux seulement. */
  sdkInt?: number;
  /** La résolution de sortie, en pixels. Sa variation relance le micro-test. */
  display?: { width: number; height: number };
}

/** Le verdict gardé du micro-test (`MicroBench.kt`). */
export interface BenchResult {
  /** Le débit de travail du meilleur passage, en unités par milliseconde. */
  score: number;
  /** La version du micro-test qui l'a mesuré : une autre version, un autre barème. */
  version: number;
  /** La durée du micro-test, en millisecondes. */
  durationMs?: number;
}

export type TierReason =
  /** L'Apple TV : toujours normal. */
  | "platform"
  /** La propriété de débogage `debug.tentacle.lite` a tranché. */
  | "debugForced"
  /** Le réglage de l'utilisateur : « Activé » / « Désactivé ». */
  | "userOn"
  | "userOff"
  /** Automatique : */
  | "lowRamDevice"
  | "lowRam"
  | "weakCores"
  | "slowBench"
  | "capable"
  | "unknown";

export interface TierVerdict {
  tier: RenderTier;
  reason: TierReason;
  /** Le détail lisible de la raison (« 1 843 Mio », « 4 × Cortex-A53 », « 410 < 900 »). */
  detail?: string;
}

/** Les seuils de la décision automatique. */
export const RENDER_TIER_THRESHOLDS = {
  /** RAM ≤ 2 Go → Lite. Le système voit un peu MOINS que la capacité nominale
   *  (2 Go → ~1,8-1,9 Gio ; 3 Go → ~2,7-2,9 Gio, la Shield Pro) : la coupure
   *  passe entre les deux, à 2,5 Gio. */
  liteRamMaxMb: 2560,
  /** La version du micro-test dont `liteBenchBelow` est le barème (miroir de `MicroBench.kt`). */
  benchVersion: 2,
  /** Sous ce score (unités par milliseconde), le micro-test dit l'appareil
   *  faible. Mesuré (07/10, app de mesure release) : Shield TV Pro 1,06,
   *  stable à 1 % sur trois lancements. Estimé : une box à 4 × A53/B53 à
   *  1,6 GHz ≈ 0,45-0,55 (IPC ~0,55-0,6 d'un A57, fréquence × 0,8). Le seuil
   *  laisse 50 % de marge à la Shield, et passe sous elle la box et tout ce
   *  qui lui ressemble. À confirmer sur une vraie box. */
  liteBenchBelow: 0.7,
} as const;

/** Rien de lu : ni mémoire, ni drapeau, ni cœurs. */
function knowsNothing(signals: DeviceSignals): boolean {
  return signals.lowRamDevice === undefined && signals.totalRamMb === undefined && !signals.coreIds?.length;
}

function usableBench(bench: BenchResult | null | undefined): BenchResult | null {
  if (!bench || bench.version !== RENDER_TIER_THRESHOLDS.benchVersion) return null;
  return Number.isFinite(bench.score) && bench.score > 0 ? bench : null;
}

/**
 * La décision AUTOMATIQUE, dans l'ordre de ce qui pèse le plus :
 * 1. le fabricant déclare la mémoire limitée — il connaît sa machine ;
 * 2. RAM ≤ 2 Go — la mémoire est la limite dure (le tueur de processus), un
 *    processeur puissant n'y change rien ;
 * 3. tous les cœurs reconnus faibles ;
 * 4. le micro-test (gardé du lancement précédent) sous son seuil.
 * Sinon `capable` — ou `unknown` quand rien n'a pu être lu : normal aussi
 * (aucun appareil ne régresse sur une lecture ratée), et le micro-test reste
 * le filet.
 */
export function decideAutoTier(signals: DeviceSignals, bench?: BenchResult | null): TierVerdict {
  const t = RENDER_TIER_THRESHOLDS;
  if (signals.lowRamDevice === true) return { tier: "lite", reason: "lowRamDevice" };
  if (signals.totalRamMb !== undefined && signals.totalRamMb <= t.liteRamMaxMb) {
    return { tier: "lite", reason: "lowRam", detail: `${Math.round(signals.totalRamMb)} Mio` };
  }
  if (allCoresWeak(signals.coreIds, signals.coreCount)) {
    return { tier: "lite", reason: "weakCores", detail: describeCores(signals.coreIds) ?? undefined };
  }
  const measured = usableBench(bench);
  if (measured && measured.score < t.liteBenchBelow) {
    return { tier: "lite", reason: "slowBench", detail: `${measured.score.toFixed(2)} < ${t.liteBenchBelow}` };
  }
  return knowsNothing(signals) && !measured ? { tier: "normal", reason: "unknown" } : { tier: "normal", reason: "capable" };
}

export interface RenderTierInput {
  platform: TierPlatform;
  /** Le réglage de l'utilisateur ; absent : automatique. */
  mode?: RenderTierMode;
  signals: DeviceSignals;
  bench?: BenchResult | null;
  /** Ce que la propriété de débogage impose (`parseForcedTier`) ; absent : rien. */
  forced?: RenderTier | null;
}

export interface RenderTierState extends TierVerdict {
  /** Le réglage en vigueur. */
  mode: RenderTierMode;
  /** Ce que dirait « Automatique » — la raison détectée, affichée sous le réglage. */
  auto: TierVerdict;
}

/**
 * Le niveau EN VIGUEUR : l'Apple TV d'abord (normal), puis le forçage de
 * débogage, puis le réglage de l'utilisateur, puis l'automatique.
 */
export function resolveRenderTier(input: RenderTierInput): RenderTierState {
  const mode = input.mode ?? "auto";
  if (input.platform === "tvos") {
    const normal: TierVerdict = { tier: "normal", reason: "platform" };
    return { ...normal, mode: "auto", auto: normal };
  }
  const auto = decideAutoTier(input.signals, input.bench);
  if (input.forced) return { tier: input.forced, reason: "debugForced", mode, auto };
  if (mode === "on") return { tier: "lite", reason: "userOn", mode, auto };
  if (mode === "off") return { tier: "normal", reason: "userOff", mode, auto };
  return { ...auto, mode, auto };
}

/** Un réglage lu du stockage ; toute autre valeur vaut « Automatique ». */
export function parseRenderTierMode(raw: unknown): RenderTierMode {
  return raw === "on" || raw === "off" ? raw : "auto";
}
