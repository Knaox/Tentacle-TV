/**
 * Presets du mode Allégé : la vérité vit dans le cœur hors ligne
 * (`@tentacle-tv/offline-core`, miroir du backend). Ici ne reste que le
 * formatage des tailles, propre au web.
 */

import { i18n } from "@tentacle-tv/shared";

export {
  LIGHT_PRESETS,
  estimateLightSizeBytes,
  type LightPreset,
  type LightPresetId,
} from "@tentacle-tv/offline-core";

/** Une décimale, au séparateur de la langue de l'interface (« 4,3 » en français, « 4.3 » en anglais). */
function oneDecimal(value: number): string {
  try {
    return new Intl.NumberFormat(i18n.language || "fr", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  } catch {
    return value.toFixed(1);
  }
}

/** Formatage lisible d'un volume en octets (Gio/Mio), à la langue de l'interface. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes < 0) return "—";
  const gib = bytes / (1024 * 1024 * 1024);
  if (gib >= 1) return `${gib >= 10 ? Math.round(gib) : oneDecimal(gib)} Gio`;
  const mib = bytes / (1024 * 1024);
  if (mib >= 1) return `${Math.round(mib)} Mio`;
  return `${Math.max(0, Math.round(bytes / 1024))} Kio`;
}
