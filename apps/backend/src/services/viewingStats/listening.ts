import type { ViewingStatsListening } from "./contract";
import type { PeriodWindow } from "./accumulate";
import type { MeasuredEntry, TitleInfo } from "./dataset";
import { rankedShares } from "./distributions";
import type { KeyedShare } from "./distributions";
import type { LocalCalendar } from "./localCalendar";
import { clampShare } from "./origins";

/**
 * « VF ou VO ? » — d'après la piste audio LUE, que le collecteur relève dans
 * chaque séance (`watch_segments.audioLang`). Rien n'est déduit : une séance
 * d'avant le relevé ne dit rien de ce qu'on a entendu, et une séance dont le
 * titre n'a pas de fiche TMDB ne dit pas si c'était la VO. Chaque base est
 * donc la sienne, et elle est rendue avec les parts.
 */

export const LISTENING_LANGUAGES_MAX = 5;
/** L'échantillon minimal : jamais un pourcentage tiré d'une poignée de séances. */
export const LISTENING_MIN_SECONDS = 3 * 3600;
export const LISTENING_MIN_SEGMENTS = 5;

/** L'écoute d'une période, sans libellé ni langue d'interface (posés à la réponse). */
export interface ListeningCore {
  /** Vide sous l'échantillon minimal. */
  languages: KeyedShare[];
  otherShare: number;
  knownSeconds: number;
  /** Base VF/VO : secondes où la piste ET la langue originale du titre sont connues. */
  versionSeconds: number;
  /** La base VF/VO atteint-elle l'échantillon minimal ? */
  versionsReady: boolean;
  originalSeconds: number;
  /** Les doublages, par langue entendue. */
  dubs: Array<{ lang: string; seconds: number }>;
}

/** Deux codes pour une même langue : TMDB dit « cn » pour le cantonais, Jellyfin « chi » ou « yue ». */
const FAMILY: Record<string, string> = { cn: "zh", yue: "zh", zh: "zh", nb: "no", nn: "no", no: "no" };
const family = (code: string): string => FAMILY[code] ?? code;

const enough = (seconds: number, segments: number) =>
  seconds >= LISTENING_MIN_SECONDS && segments >= LISTENING_MIN_SEGMENTS;

export function listeningOf(
  measured: readonly MeasuredEntry[],
  win: PeriodWindow,
  calendar: LocalCalendar,
  titles: Map<string, TitleInfo>
): ListeningCore {
  const byLang = new Map<string, number>();
  const dubs = new Map<string, number>();
  let known = 0;
  let segments = 0;
  let versionSeconds = 0;
  let versionSegments = 0;
  let originalSeconds = 0;
  for (const seg of measured) {
    if (!seg.audioLang || seg.seconds <= 0 || !win.contains(calendar.parts(seg.startedAt).day)) continue;
    known += seg.seconds;
    segments += 1;
    byLang.set(seg.audioLang, (byLang.get(seg.audioLang) ?? 0) + seg.seconds);
    const original = titles.get(seg.titleId)?.originalLanguage;
    if (!original) continue;
    versionSeconds += seg.seconds;
    versionSegments += 1;
    if (family(original) === family(seg.audioLang)) originalSeconds += seg.seconds;
    else dubs.set(seg.audioLang, (dubs.get(seg.audioLang) ?? 0) + seg.seconds);
  }
  const languages = enough(known, segments) ? rankedShares(byLang, known, LISTENING_LANGUAGES_MAX) : [];
  const listed = languages.reduce((n, l) => n + (byLang.get(l.key) ?? 0), 0);
  return {
    languages,
    otherShare: languages.length > 0 ? clampShare((known - listed) / known) : 0,
    knownSeconds: known,
    versionSeconds,
    versionsReady: enough(versionSeconds, versionSegments),
    originalSeconds,
    dubs: [...dubs].map(([lang, seconds]) => ({ lang, seconds })),
  };
}

/** La première séance relevée du compte (ms), toutes périodes ; null : jamais relevé. */
export function listeningSince(measured: readonly MeasuredEntry[]): number | null {
  let first: number | null = null;
  for (const seg of measured) if (seg.audioLang && (first === null || seg.startedAt < first)) first = seg.startedAt;
  return first;
}

/**
 * VO, VF, autres doublages — « VF » veut dire doublage dans la langue de
 * l'interface : le français pour « fr », l'anglais pour « en ».
 */
export function versionsFor(core: ListeningCore, lang: string): ViewingStatsListening["versions"] {
  if (!core.versionsReady || core.versionSeconds <= 0) return null;
  const base = core.versionSeconds;
  const dubbed = core.dubs.reduce((n, d) => n + d.seconds, 0);
  const local = core.dubs.filter((d) => family(d.lang) === family(lang)).reduce((n, d) => n + d.seconds, 0);
  return {
    original: clampShare(core.originalSeconds / base),
    local: clampShare(local / base),
    otherDubs: clampShare((dubbed - local) / base),
  };
}
