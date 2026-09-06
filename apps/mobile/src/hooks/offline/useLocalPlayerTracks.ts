import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { OnLoadData } from "react-native-video";
import { i18n, resolveMediaTracks, type MediaStream as JfStream } from "@tentacle-tv/shared";
import { formatLocalTrackLabel, itemTracksFor, parseSideCarFileName, prefForLibrary, type ItemTrackChoice, type SubtitleMode } from "@tentacle-tv/offline-core";
import type { OfflineLocalSource } from "@/offline/engineApi";
import { prefsStore } from "@/offline/prefsCache";
import { useRememberLocalTracks } from "./useRememberLocalTracks";

export interface Track {
  index: number;
  label: string;
  lang?: string;
  forced?: boolean;
}

type NativeAudioTrack = OnLoadData["audioTracks"][number];

/** `langMatches` compare des codes nus : « fr-BE » ne correspondrait à rien sans ce découpage. */
const baseLang = (lang: string | undefined): string | undefined => lang?.split("-")[0]?.toLowerCase();

interface Options {
  userId: string | null;
  itemId: string;
  localSource: OfflineLocalSource;
  /** Les pistes du snapshot — leurs `DisplayTitle` enrichissent la liste native de l'Original. */
  streams: JfStream[];
}

/**
 * Les pistes d'une lecture LOCALE. L'audio vient de la liste NATIVE du fichier
 * (`onLoad.audioTracks`, comme la track-list mpv du bureau — un lecteur qui
 * omet une piste ne décale rien), les sous-titres des side-cars VTT. Les
 * langues préférées sont résolues localement par LE MÊME algorithme que le
 * serveur (le contenu d'abord, la bibliothèque ensuite), une fois, quand le
 * fichier est chargé ; un choix explicite est mémorisé.
 */
export function useLocalPlayerTracks({ userId, itemId, localSource, streams }: Options) {
  const { t } = useTranslation("player");
  const [nativeAudio, setNativeAudio] = useState<readonly NativeAudioTrack[]>([]);
  /** Index NATIF de la piste audio (-1 : laisser le lecteur choisir). */
  const [audioIndex, setAudioIndex] = useState(-1);
  /** Index Jellyfin du side-car choisi (-1 : aucun). */
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const appliedRef = useRef(false);
  const [override, setOverride] = useState(false);
  const label = useCallback(
    (track: { lang?: string; title?: string; codec?: string; forced?: boolean; sdh?: boolean }, index: number) =>
      formatLocalTrackLabel(track, { locale: i18n.language, fallback: t("trackFallback", { index, defaultValue: `#${index}` }) }),
    [t],
  );

  const onLoad = useCallback((data: OnLoadData) => {
    setNativeAudio(data.audioTracks ?? []);
  }, []);

  const audioTracks: Track[] = useMemo(() => {
    const snapshotAudio = streams.filter((s) => s.Type === "Audio");
    // L'Original est le fichier du serveur : quand les comptes coïncident, les
    // titres Jellyfin (« Japonais - AC3 5.1 ») valent mieux que ceux du lecteur.
    const enrich = localSource.variant === "original" && snapshotAudio.length === nativeAudio.length;
    return nativeAudio.map((track, position) => {
      const jf = enrich ? snapshotAudio[position] : undefined;
      return {
        index: track.index,
        label: jf?.DisplayTitle ?? label({ lang: track.language, title: track.title }, track.index),
        lang: baseLang(track.language ?? jf?.Language),
      };
    });
  }, [nativeAudio, streams, localSource.variant, label]);

  const sideCars = useMemo(
    () => localSource.subtitleUris
      .map((file) => ({ ...file, parsed: parseSideCarFileName(file.fileName) }))
      .filter((file) => file.parsed !== null && file.parsed.format === "vtt"),
    [localSource.subtitleUris],
  );
  const subtitleTracks: Track[] = useMemo(
    () => sideCars.map((file) => {
      const parsed = file.parsed!;
      const stream = streams.find((s) => s.Type === "Subtitle" && s.Index === parsed.jfIndex);
      return {
        index: parsed.jfIndex,
        label: label({ lang: parsed.lang, title: stream?.Title, codec: parsed.format, forced: parsed.forced, sdh: parsed.sdh }, parsed.jfIndex),
        lang: baseLang(parsed.lang),
        forced: parsed.forced,
      };
    }),
    [sideCars, streams, label],
  );
  const subtitleVttUrl = useMemo(
    () => sideCars.find((file) => file.parsed!.jfIndex === subtitleIndex)?.uri ?? null,
    [sideCars, subtitleIndex],
  );

  // Résolution des préférences : une fois, quand les pistes du fichier sont connues.
  useEffect(() => {
    if (appliedRef.current || userId === null || nativeAudio.length === 0) return;
    appliedRef.current = true;
    const cached = itemTracksFor(prefsStore, userId, itemId) ?? prefForLibrary(prefsStore, userId, localSource.libraryId);
    if (!cached) return;
    const resolved = resolveMediaTracks(
      { jellyfinUserId: userId, libraryId: localSource.libraryId ?? "", audioLang: cached.audioLang, subtitleLang: cached.subtitleLang, subtitleMode: cached.subtitleMode },
      audioTracks.map((track, position) => ({ index: track.index, language: track.lang, isDefault: nativeAudio[position]?.selected === true, title: track.label })),
      subtitleTracks.map((track) => ({ index: track.index, language: track.lang, isForced: track.forced === true, title: track.label })),
    );
    if (resolved.audioIndex != null) setAudioIndex(resolved.audioIndex);
    setSubtitleIndex(resolved.subtitleIndex ?? -1);
  }, [userId, itemId, localSource.libraryId, nativeAudio, audioTracks, subtitleTracks]);

  const changeAudio = useCallback((index: number) => { setOverride(true); setAudioIndex(index); }, []);
  const changeSubtitle = useCallback((index: number) => { setOverride(true); setSubtitleIndex(index); }, []);

  // Le choix explicite, mémorisé (miroir local, puis serveur en ligne).
  const choice = useMemo<ItemTrackChoice | null>(() => {
    if (!override) return null;
    const audioLang = audioTracks.find((track) => track.index === audioIndex)?.lang ?? null;
    const sub = subtitleTracks.find((track) => track.index === subtitleIndex);
    const subtitleMode: SubtitleMode = !sub ? "none" : /\b(sign|songs)\b/i.test(sub.label) ? "signs" : sub.forced ? "forced" : "always";
    return { audioLang, subtitleLang: sub?.lang ?? null, subtitleMode };
  }, [override, audioTracks, subtitleTracks, audioIndex, subtitleIndex]);
  useRememberLocalTracks({ userId, itemId, choice });

  return { onLoad, audioTracks, subtitleTracks, audioIndex, subtitleIndex, subtitleVttUrl, changeAudio, changeSubtitle };
}
