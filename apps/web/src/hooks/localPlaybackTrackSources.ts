/**
 * Pistes d'une lecture LOCALE : fusion des sous-titres INTERNES (track-list
 * mpv) et des SIDE-CARS téléchargés (`media/<item>/subs/<index>-<lang>.<ext>`).
 *
 * Deux espaces d'index cohabitent et ne doivent jamais être confondus :
 * - piste interne → identifiant mpv (`sid`), petit entier ;
 * - side-car → index Jellyfin d'origine, décalé de SIDECAR_INDEX_BASE.
 * Le décalage rend la collision impossible et permet à l'appelant de savoir,
 * du seul index, qu'une piste doit passer par `sub-add` plutôt que par `sid`.
 *
 * Aucun doublon à craindre : un side-car est par construction un sous-titre
 * EXTERNE (variante Original) ou une piste extraite (variante Allégée, qui
 * n'embarque aucun sous-titre texte) — jamais présent dans la track-list mpv
 * avant son chargement explicite.
 */

import type { AudioTrack, SubtitleTrack } from "../components/VideoPlayer";
import type { MpvTrack } from "./useDesktopPlayer";
import type { LocalSubtitleFile } from "../downloads/playbackApi";
import { formatLocalTrackLabel } from "./localTrackLabels";

/** Décalage des index de side-cars (les sid mpv et index Jellyfin restent < 1000). */
export const SIDECAR_INDEX_BASE = 1000;

export function isSideCarIndex(index: number | null | undefined): boolean {
  return typeof index === "number" && index >= SIDECAR_INDEX_BASE;
}

export interface LabelContext {
  locale: string;
  fallbackFor: (index: number) => string;
}

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
  const parts = match[2].split("-");
  const suffixes = parts.slice(1).map((p) => p.toLowerCase());
  return {
    jfIndex: Number(match[1]),
    lang: parts[0] ?? "und",
    forced: suffixes.includes("forced"),
    sdh: suffixes.includes("sdh"),
    format: match[3].toLowerCase(),
  };
}

export function buildLocalAudioTracks(mpvAudio: MpvTrack[], ctx: LabelContext): AudioTrack[] {
  return mpvAudio
    .filter((t) => typeof t.id === "number")
    .map((t) => ({
      index: t.id,
      label: formatLocalTrackLabel(t, { locale: ctx.locale, fallback: ctx.fallbackFor(t.id) }),
      lang: t.lang ?? undefined,
    }));
}

/**
 * Sous-titres proposés en lecture locale : internes puis side-cars. Les
 * internes n'ont pas d'URL (mpv les lit nativement via `sid`) ; les side-cars
 * portent leur chemin absolu, à charger par `sub-add`.
 */
export function buildLocalSubtitleTracks(
  mpvSubs: MpvTrack[],
  sideCarFiles: LocalSubtitleFile[],
  ctx: LabelContext,
): SubtitleTrack[] {
  const internal: SubtitleTrack[] = mpvSubs
    // Une piste externe de la track-list est un side-car DÉJÀ chargé par
    // sub-add : il est listé ci-dessous depuis le disque, ne pas le doubler.
    .filter((t) => typeof t.id === "number" && t.external !== true)
    .map((t) => ({
      index: t.id,
      label: formatLocalTrackLabel(t, { locale: ctx.locale, fallback: ctx.fallbackFor(t.id) }),
      url: "",
      lang: t.lang ?? undefined,
      codec: t.codec ?? undefined,
    }));

  const sideCars: SubtitleTrack[] = sideCarFiles.flatMap((file) => {
    const parsed = parseSideCarFileName(file.fileName);
    if (!parsed) return [];
    const index = SIDECAR_INDEX_BASE + parsed.jfIndex;
    return [{
      index,
      label: formatLocalTrackLabel(
        { lang: parsed.lang, forced: parsed.forced, sdh: parsed.sdh, codec: parsed.format },
        { locale: ctx.locale, fallback: ctx.fallbackFor(parsed.jfIndex) },
      ),
      url: file.absolutePath,
      lang: parsed.lang,
      codec: parsed.format,
      forced: parsed.forced,
    }];
  });

  return [...internal, ...sideCars];
}

/** Piste forcée ? mpv ne pose pas ce drapeau sur un side-car : le nom fait foi. */
export function isForcedTrack(track: SubtitleTrack): boolean {
  return track.forced === true || /\bforc(ed|é|ee|ée)s?\b/i.test(track.label);
}
