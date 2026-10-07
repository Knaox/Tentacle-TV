import { normalizeCoreId, type CoreId } from "./cpuCores";
import { RENDER_TIER_THRESHOLDS, type BenchResult, type DeviceSignals, type RenderTier } from "./renderTier";

/**
 * Les signaux SIMULÉS, pour le banc et les essais (jamais pour l'utilisateur) :
 * deux propriétés système, lues par le module natif au lancement et
 * interprétées ICI (une seule grammaire, testée).
 *
 *   adb shell setprop debug.tentacle.lite 1              Lite forcé (0 : normal forcé)
 *   adb shell setprop debug.tentacle.lite.signals netplus
 *   adb shell setprop debug.tentacle.lite.signals "ram=1900,parts=0x41:0xd03*4,bench=0.5"
 *   adb shell setprop debug.tentacle.lite.signals ""     pour revenir aux vrais signaux
 *
 * Puis relancer l'app. Un profil nommé remplace TOUS les signaux ; des
 * `clé=valeur` après lui (ou seuls) remplacent ceux qu'ils nomment. Une
 * propriété système tient en 91 caractères (Android 9) : d'où les profils.
 */

export interface SignalOverride {
  /** Vrai : les signaux réels sont oubliés (un profil nommé). */
  replace: boolean;
  signals: DeviceSignals;
  /** Un score de micro-test injecté (à la version courante). */
  bench?: BenchResult;
}

const times = (id: CoreId, count: number): CoreId[] => Array.from({ length: count }, () => id);

/** Les appareils de référence du chantier, simulés. */
export const SIMULATED_DEVICES: Readonly<Record<string, DeviceSignals>> = {
  /** Box net+ UZX4020NPS : BCM7271, 4 × Brahma-B53 à 1,6 GHz, 2 Go, Android TV 9. */
  netplus: {
    lowRamDevice: false, totalRamMb: 1890, memoryClassMb: 192, coreCount: 4, maxFreqMhz: 1600,
    coreIds: times("0x42:0x100", 4), soc: "BCM7271", sdkInt: 28, display: { width: 1920, height: 1080 },
  },
  /** Le plancher : Android TV à 1 Go (déclarée « low RAM »), 4 × Cortex-A53. */
  "1gb": {
    lowRamDevice: true, totalRamMb: 930, memoryClassMb: 96, coreCount: 4, maxFreqMhz: 1500,
    coreIds: times("0x41:0xd03", 4), soc: "S905Y2", sdkInt: 30, display: { width: 1920, height: 1080 },
  },
  /** Shield TV Pro 2019 : ses signaux tels que lus le 07/10 (Tegra X1+, 4 × Cortex-A57 visibles, 3 Go, Android 11). */
  shield: {
    lowRamDevice: false, totalRamMb: 2946, memoryClassMb: 192, coreCount: 4, maxFreqMhz: 2014,
    coreIds: times("0x41:0xd07", 4), soc: "tegra", sdkInt: 30, display: { width: 3840, height: 2160 },
  },
  /** Un appareil dont rien n'a pu être lu. */
  unknown: {},
};

/** `debug.tentacle.lite` : « 1 », « on », « lite » → Lite ; « 0 », « off », « normal » → normal. */
export function parseForcedTier(raw: string | null | undefined): RenderTier | null {
  const value = raw?.trim().toLowerCase();
  if (value === "1" || value === "on" || value === "lite") return "lite";
  if (value === "0" || value === "off" || value === "normal") return "normal";
  return null;
}

const toNumber = (value: string): number | undefined => {
  const parsed = Number(value);
  return value !== "" && Number.isFinite(parsed) ? parsed : undefined;
};

/** `0x41:0xd03*4` ou `0x41:0xd07;0x41:0xd03` : les identités des cœurs. */
function parseParts(value: string): CoreId[] | undefined {
  const ids: CoreId[] = [];
  for (const chunk of value.split(";")) {
    const [raw, count] = chunk.split("*");
    const id = normalizeCoreId(raw ?? "");
    if (!id) return undefined;
    ids.push(...times(id, count === undefined ? 1 : Math.max(1, Math.trunc(Number(count)) || 1)));
  }
  return ids.length ? ids : undefined;
}

function applyPair(signals: DeviceSignals, key: string, value: string, out: SignalOverride): void {
  switch (key) {
    case "lowram": signals.lowRamDevice = value === "1" || value === "true"; break;
    case "ram": signals.totalRamMb = toNumber(value); break;
    case "memclass": signals.memoryClassMb = toNumber(value); break;
    case "cores": signals.coreCount = toNumber(value); break;
    case "freq": signals.maxFreqMhz = toNumber(value); break;
    case "parts": signals.coreIds = parseParts(value); break;
    case "soc": signals.soc = value || undefined; break;
    case "sdk": signals.sdkInt = toNumber(value); break;
    case "res": {
      const [width, height] = value.split("x").map(Number);
      if (width > 0 && height > 0) signals.display = { width, height };
      break;
    }
    case "bench": {
      const score = toNumber(value);
      if (score !== undefined) out.bench = { score, version: RENDER_TIER_THRESHOLDS.benchVersion };
      break;
    }
    default: break;
  }
}

/** `debug.tentacle.lite.signals` lu ; `null` quand il est vide ou illisible. */
export function parseSignalOverride(raw: string | null | undefined): SignalOverride | null {
  const text = raw?.trim();
  if (!text) return null;
  const out: SignalOverride = { replace: false, signals: {} };
  for (const token of text.split(",").map((t) => t.trim()).filter(Boolean)) {
    const eq = token.indexOf("=");
    if (eq < 0) {
      const preset = SIMULATED_DEVICES[token.toLowerCase()];
      if (!preset) continue;
      out.replace = true;
      out.signals = { ...preset, ...out.signals };
      continue;
    }
    applyPair(out.signals, token.slice(0, eq).trim().toLowerCase(), token.slice(eq + 1).trim(), out);
  }
  const touched = out.replace || out.bench !== undefined || Object.keys(out.signals).length > 0;
  return touched ? out : null;
}

/** Les signaux réels, corrigés par la simulation. */
export function applySignalOverride(real: DeviceSignals, override: SignalOverride | null): DeviceSignals {
  if (!override) return real;
  const defined = Object.fromEntries(Object.entries(override.signals).filter(([, v]) => v !== undefined));
  return override.replace ? { ...defined } : { ...real, ...defined };
}
