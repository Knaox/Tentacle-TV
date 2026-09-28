import type { LocalVersion } from "@tentacle-tv/offline-core";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * La version d'un fichier avec les mots du bureau : « Original », « Allégé
 * 720p », « Plusieurs versions » pour une série mêlée. La copie d'image
 * (palier `pmax`) n'existe que sur le téléphone ; sur une machine elle se lirait
 * comme l'original, qu'elle est à l'image près.
 */
export function versionLabel(t: Translate, version: LocalVersion | null): string | null {
  if (version === null) return null;
  switch (version.kind) {
    case "original":
    case "remux":
      return t("downloads:variantOriginal");
    case "light":
      return version.height ? `${t("downloads:variantLight")} ${version.height}p` : t("downloads:variantLight");
    case "mixed":
      return t("downloads:detailVersionMixed");
  }
}

/** « 12 sept. 2026 » — la date d'arrivée d'un fichier (epoch MILLISECONDES). */
export function addedOnLabel(createdAtMs: number, locale: string): string | null {
  if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) return null;
  return new Date(createdAtMs).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}
