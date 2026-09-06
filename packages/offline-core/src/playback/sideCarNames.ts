/**
 * Le nom d'un side-car de sous-titres, `media/<item>/subs/<index>-<lang>.<ext>`,
 * dit tout ce que le lecteur doit savoir : l'index Jellyfin d'origine, la
 * langue, et les drapeaux forcé / malentendants. Aucune base à consulter.
 */

export interface ParsedSideCar {
  /** Index Jellyfin d'origine (celui du nom de fichier). */
  jfIndex: number;
  lang: string;
  forced: boolean;
  sdh: boolean;
  format: string;
}

/** `3-fre-forced.srt` → index 3, français, forcé. */
export function parseSideCarFileName(fileName: string): ParsedSideCar | null {
  const match = fileName.match(/^(\d+)-([a-z0-9-]+)\.(srt|ass|vtt)$/i);
  if (!match) return null;
  const parts = (match[2] ?? "").split("-");
  const suffixes = parts.slice(1).map((p) => p.toLowerCase());
  return {
    jfIndex: Number(match[1]),
    lang: parts[0] ?? "und",
    forced: suffixes.includes("forced"),
    sdh: suffixes.includes("sdh"),
    format: (match[3] ?? "").toLowerCase(),
  };
}
