/**
 * Presets du mode Allégé — MIROIR de `apps/backend/src/routes/downloads.ts`
 * (le backend reste l'autorité : un preset inconnu y est refusé).
 * L'estimation de taille sert au contrôle d'espace et à l'affichage du
 * dialogue de téléchargement : durée × (débit vidéo + audio) × 1,15 de marge.
 */

export type LightPresetId = "p1080" | "p720" | "p480";

export interface LightPreset {
  id: LightPresetId;
  maxHeight: number;
  videoBitRate: number;
  audioBitRate: number;
}

export const LIGHT_PRESETS: readonly LightPreset[] = [
  { id: "p1080", maxHeight: 1080, videoBitRate: 8_000_000, audioBitRate: 192_000 },
  { id: "p720", maxHeight: 720, videoBitRate: 4_000_000, audioBitRate: 160_000 },
  { id: "p480", maxHeight: 480, videoBitRate: 1_500_000, audioBitRate: 128_000 },
] as const;

const TICKS_PER_SECOND = 10_000_000;
const ESTIMATE_MARGIN = 1.15;

export function estimateLightSizeBytes(
  runtimeTicks: number | null | undefined,
  presetId: LightPresetId,
): number | null {
  if (!runtimeTicks || runtimeTicks <= 0) return null;
  const preset = LIGHT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  const seconds = runtimeTicks / TICKS_PER_SECOND;
  const bytesPerSecond = (preset.videoBitRate + preset.audioBitRate) / 8;
  return Math.round(seconds * bytesPerSecond * ESTIMATE_MARGIN);
}

/** Formatage lisible d'un volume en octets (Gio/Mio), locale-neutre. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes < 0) return "—";
  const gib = bytes / (1024 * 1024 * 1024);
  if (gib >= 1) return `${gib.toFixed(gib >= 10 ? 0 : 1)} Gio`;
  const mib = bytes / (1024 * 1024);
  if (mib >= 1) return `${Math.round(mib)} Mio`;
  return `${Math.max(0, Math.round(bytes / 1024))} Kio`;
}
