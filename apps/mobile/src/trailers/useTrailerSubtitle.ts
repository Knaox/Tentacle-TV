import { useCallback, useEffect, useMemo, useState } from "react";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import {
  TRAILER_SUBTITLES_OFF, trailerStartSubtitle, trailerSubtitleKey, trailerSubtitleMemoryOf,
  type TrailerStream, type TrailerVersion,
} from "@tentacle-tv/shared";
import { parseStoredUser, STORED_USER_KEY } from "@/auth/storedUser";

export interface TrailerSubtitleChoice {
  /** La langue de la piste affichée, ou `null` : désactivés. */
  lang: string | null;
  /** La piste qu'un toucher sur « Sous-titres » allume, ou `null` : le bouton n'a rien à offrir. */
  toggleTarget: string | null;
  toggle: () => void;
}

/**
 * Les sous-titres d'une bande-annonce relayée, comme sur le web et le bureau
 * (`trailerStartSubtitle`, shared) : le choix RETENU par le compte
 * (`tentacle_trailer_subtitle:<id>`, le même que les autres appareils
 * gardent pour eux), sinon la piste posée dans la langue du serveur — sauf
 * pour une bande-annonce déjà dans cette langue —, jamais la reconnaissance
 * vocale d'office. Un toucher bascule entre « désactivés » et cette piste, et
 * le choix est retenu pour les suivantes.
 */
export function useTrailerSubtitle(
  stream: TrailerStream | null,
  context: { language: string | null; version?: TrailerVersion },
): TrailerSubtitleChoice {
  const { storage } = useTentacleConfig();
  const key = useMemo(() => {
    const user = parseStoredUser(storage.getItem(STORED_USER_KEY));
    return user?.Id ? trailerSubtitleKey(user.Id) : null;
  }, [storage]);
  const tracks = stream?.subtitles;
  const { language, version } = context;

  const [lang, setLang] = useState<string | null>(null);
  useEffect(() => {
    const remembered = key ? storage.getItem(key) : null;
    setLang(tracks ? trailerStartSubtitle(tracks, remembered, { language: language ?? stream?.language, version }) : null);
  }, [tracks, key, storage, language, version, stream?.language]);

  // La piste à rallumer : la langue du serveur (posée), sinon la première posée, sinon la première.
  const toggleTarget = useMemo(() => {
    if (!tracks || tracks.length === 0) return null;
    const wanted = (language ?? stream?.language ?? "").toLowerCase().split(/[-_]/)[0];
    const posed = tracks.filter((track) => !track.auto);
    return (posed.find((track) => track.lang.toLowerCase().split(/[-_]/)[0] === wanted) ?? posed[0] ?? tracks[0]).lang;
  }, [tracks, language, stream?.language]);

  const toggle = useCallback(() => {
    const next = lang ? null : toggleTarget;
    setLang(next);
    if (key) storage.setItem(key, trailerSubtitleMemoryOf(next ?? TRAILER_SUBTITLES_OFF));
  }, [lang, toggleTarget, key, storage]);

  return { lang, toggleTarget, toggle };
}
