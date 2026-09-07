import { i18n } from "@tentacle-tv/shared";

const KIB = 1024;
const MIB = KIB * 1024;
const GIB = MIB * 1024;

/** Une taille lisible, unités traduites (Gio / Mio / Kio — GiB / MiB / KiB). */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return i18n.t("offline:sizeUnknown");
  const unit = (key: string): string => i18n.t(`offline:${key}`);
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(bytes >= 10 * GIB ? 1 : 2)} ${unit("unitGiB")}`;
  if (bytes >= MIB) return `${Math.round(bytes / MIB)} ${unit("unitMiB")}`;
  return `${Math.max(1, Math.round(bytes / KIB))} ${unit("unitKiB")}`;
}
