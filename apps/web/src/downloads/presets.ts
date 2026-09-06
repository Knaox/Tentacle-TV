/**
 * Presets du mode Allégé : la vérité vit dans le cœur hors ligne
 * (`@tentacle-tv/offline-core`, miroir du backend). Ici ne reste que le
 * formatage des tailles, propre au web.
 */

export {
  LIGHT_PRESETS,
  estimateLightSizeBytes,
  type LightPreset,
  type LightPresetId,
} from "@tentacle-tv/offline-core";

/** Formatage lisible d'un volume en octets (Gio/Mio), locale-neutre. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes < 0) return "—";
  const gib = bytes / (1024 * 1024 * 1024);
  if (gib >= 1) return `${gib.toFixed(gib >= 10 ? 0 : 1)} Gio`;
  const mib = bytes / (1024 * 1024);
  if (mib >= 1) return `${Math.round(mib)} Mio`;
  return `${Math.max(0, Math.round(bytes / 1024))} Kio`;
}
