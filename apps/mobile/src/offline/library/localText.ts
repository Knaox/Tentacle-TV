import type { LocalVersion } from "@tentacle-tv/offline-core";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * La version d'un fichier avec les mots du téléphone (espace `offline`, jamais
 * le mot interdit) : « Qualité d'origine », « Qualité d'origine (MP4) »,
 * « Allégé 720p », « Plusieurs versions » pour une série mêlée.
 */
export function versionText(t: Translate, version: LocalVersion | null): string | null {
  if (version === null) return null;
  switch (version.kind) {
    case "original":
      return t("offline:variantOriginal");
    case "remux":
      return t("offline:variantRemux");
    case "light":
      return version.height ? `${t("downloads:variantLight")} ${version.height}p` : t("downloads:variantLight");
    case "mixed":
      return t("offline:versionMixed");
  }
}

/** « 12 sept. 2026 » — l'arrivée d'un fichier (epoch MILLISECONDES). */
export function addedOnText(createdAtMs: number, locale: string): string | null {
  if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) return null;
  return new Date(createdAtMs).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}
