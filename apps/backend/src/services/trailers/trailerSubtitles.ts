/* ------------------------------------------------------------------ */
/*  Les sous-titres d'une bande-annonce — le choix des pistes, pur     */
/*                                                                     */
/*  yt-dlp rend deux familles : `subtitles` (posés par la chaîne) et   */
/*  `automatic_captions` (la reconnaissance vocale de YouTube, `-orig`,*/
/*  et ses traductions automatiques dans ~150 langues). On garde :     */
/*   - les pistes posées, toutes langues (sauf `live_chat`) ;          */
/*   - la reconnaissance vocale d'origine, si aucune piste posée ne    */
/*     parle déjà cette langue ;                                       */
/*   - sa traduction dans une langue de l'interface (`TRANSLATED_LANGS`)*/
/*     que rien d'autre ne couvre.                                     */
/*  Seules les URL `youtube.com/api/timedtext` sont prises : elles ne  */
/*  sont pas liées à l'adresse IP (`ip=0.0.0.0`), le serveur les relit */
/*  et les rend en WebVTT. Jamais une URL YouTube au téléviseur.       */
/*  Mesuré le 2026-10-11 (yt-dlp 2026.08.19, `visionos`) : cf.         */
/*  docs/BANDES-ANNONCES.md, « Qualités et sous-titres ».              */
/* ------------------------------------------------------------------ */

/** Une entrée de `subtitles` / `automatic_captions` (yt-dlp `-j`). */
export interface YtCaption {
  ext?: string;
  url?: string;
  name?: string;
}

export type YtCaptionMap = Record<string, YtCaption[] | undefined>;

export interface YtCaptions {
  subtitles?: YtCaptionMap;
  automatic_captions?: YtCaptionMap;
}

/** Une piste gardée pour la vidéo, avant le choix par langue de l'interface. */
export interface SubtitleCandidate {
  /** Clé de relais, stable pour la vidéo (`m-en-US`, `a-en`, `t-fr`) — une route, pas un nom traduit. */
  key: string;
  /** Code de langue de YouTube (`en`, `en-US`, `pt-BR`). */
  lang: string;
  /** Le nom que YouTube donne à la piste (en anglais) ; l'écran peut le remplacer par la langue. */
  label: string;
  /** Reconnaissance vocale ou traduction automatique. */
  auto: boolean;
  /** Traduction automatique de la reconnaissance vocale (gardée seulement vers l'interface ou l'anglais). */
  translated: boolean;
  url: string;
  format: "json3" | "vtt";
}

/** Les langues de l'interface des clients : les seules traductions automatiques gardées. */
export const TRANSLATED_LANGS = ["fr", "en"] as const;
/** Une liste courte : l'écran la montre en entier, et chaque piste se relaie. */
export const MAX_SUBTITLES = 6;
/** Pistes posées gardées par vidéo, avant le choix (une chaîne en pose rarement plus de dix). */
const MAX_MANUAL = 16;

const LANG_RE = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8}){0,2}$/;
const TIMEDTEXT_RE = /^https:\/\/(?:www\.)?youtube\.com\/api\/timedtext\?/;

export const baseLang = (lang: string) => lang.split("-")[0].toLowerCase();

/** L'entrée lisible d'une piste : `json3` (que le serveur convertit proprement), sinon `vtt`. */
function pickEntry(entries: YtCaption[] | undefined): { url: string; format: "json3" | "vtt"; name?: string } | null {
  const usable = (entries ?? []).filter((e) => typeof e.url === "string" && TIMEDTEXT_RE.test(e.url));
  for (const format of ["json3", "vtt"] as const) {
    const entry = usable.find((e) => e.ext === format);
    if (entry?.url) return { url: entry.url, format, name: entry.name };
  }
  return null;
}

/** Les pistes que la vidéo offre, dans l'ordre de YouTube — le choix vient après (`orderSubtitles`). */
export function collectSubtitleCandidates(info: YtCaptions): SubtitleCandidate[] {
  const out: SubtitleCandidate[] = [];
  const covered = new Set<string>();
  for (const [lang, entries] of Object.entries(info.subtitles ?? {})) {
    if (out.length >= MAX_MANUAL || !LANG_RE.test(lang)) continue;
    const entry = pickEntry(entries);
    if (!entry) continue;
    out.push({ key: `m-${lang}`, lang, label: entry.name ?? lang, auto: false, translated: false, url: entry.url, format: entry.format });
    covered.add(baseLang(lang));
  }

  const automatic = info.automatic_captions ?? {};
  const origKey = Object.keys(automatic).find((k) => k.endsWith("-orig") && LANG_RE.test(k.slice(0, -5)));
  if (origKey) {
    const lang = origKey.slice(0, -5);
    const entry = pickEntry(automatic[origKey]);
    if (entry && !covered.has(baseLang(lang))) {
      out.push({ key: `a-${lang}`, lang, label: (entry.name ?? lang).replace(/\s*\(Original\)$/i, ""), auto: true, translated: false, url: entry.url, format: entry.format });
      covered.add(baseLang(lang));
    }
  }
  // Une traduction n'existe que d'une reconnaissance vocale : sans `-orig`, rien à traduire.
  if (origKey) {
    for (const lang of TRANSLATED_LANGS) {
      if (covered.has(lang)) continue;
      const entry = pickEntry(automatic[lang]);
      if (!entry) continue;
      out.push({ key: `t-${lang}`, lang, label: entry.name ?? lang, auto: true, translated: true, url: entry.url, format: entry.format });
      covered.add(lang);
    }
  }
  return out;
}

/**
 * La liste rendue au téléviseur : la langue de l'interface en tête, l'anglais
 * ensuite, puis les autres ; une piste posée avant une automatique de la même
 * langue. Une traduction automatique n'est gardée que vers la langue de
 * l'interface ou l'anglais. Bornée à `MAX_SUBTITLES`.
 */
export function orderSubtitles(candidates: readonly SubtitleCandidate[], uiLang: string | undefined): SubtitleCandidate[] {
  const ui = uiLang ? baseLang(uiLang) : "en";
  const rank = (lang: string) => (baseLang(lang) === ui ? 0 : baseLang(lang) === "en" ? 1 : 2);
  return candidates
    .filter((c) => !c.translated || rank(c.lang) < 2)
    .map((c, index) => ({ c, index }))
    .sort((a, b) => rank(a.c.lang) - rank(b.c.lang) || Number(a.c.auto) - Number(b.c.auto) || a.index - b.index)
    .slice(0, MAX_SUBTITLES)
    .map(({ c }) => c);
}
