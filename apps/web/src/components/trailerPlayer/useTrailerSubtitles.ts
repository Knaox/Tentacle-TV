/**
 * Les sous-titres du lecteur des bandes-annonces : les pistes du relais
 * (WebVTT de YouTube, rangées par le serveur), le choix au lancement et sa
 * mémoire par COMPTE (`tentacle_trailer_subtitle:<id>`, la clé des
 * téléviseurs), et l'URL `blob:` nettoyée à poser sur le `<track>` — jamais
 * un `<track>` d'une autre origine (`useSanitizedSubtitles`).
 *
 * Au lancement (`trailerStartSubtitle`, shared) : le choix retenu, sinon la
 * piste posée dans la langue du SERVEUR, sauf pour une bande-annonce déjà
 * dans cette langue. C les fait basculer.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import {
  TRAILER_SUBTITLES_OFF, trailerStartSubtitle, trailerSubtitleKey, trailerSubtitleMemoryOf,
  type TrailerStream, type TrailerVersion,
} from "@tentacle-tv/shared";
import { useSanitizedSubtitles } from "../../hooks/useSanitizedSubtitles";
import { backendAbsoluteUrl } from "../../trailerPreview/previewStream";
import type { SubtitleTrack } from "../player/videoPlayer.types";

function readMemory(key: string | null): string | null {
  if (!key) return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeMemory(key: string | null, value: string): void {
  if (!key) return;
  try { localStorage.setItem(key, value); } catch { /* stockage refusé : rien ne se retient */ }
}

export function useTrailerSubtitles(stream: TrailerStream | null, context: { language: string | null; version?: TrailerVersion }) {
  const userId = useUserId();
  // Sans compte connu, rien ne se retient : aucune clé partagée entre profils.
  const memoryKey = userId ? trailerSubtitleKey(userId) : null;
  const language = stream?.language ?? context.language;
  const [selected, setSelected] = useState<string | null>(null);

  // Un flux neuf : le choix au lancement.
  useEffect(() => {
    setSelected(stream ? trailerStartSubtitle(stream.subtitles, readMemory(memoryKey), { language, version: context.version }) : null);
    // La version et la langue vont avec le flux : seul un flux neuf relance le choix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, memoryKey]);

  const choose = useCallback((lang: string | null) => {
    setSelected(lang);
    writeMemory(memoryKey, trailerSubtitleMemoryOf(lang ?? TRAILER_SUBTITLES_OFF));
  }, [memoryKey]);

  const toggle = useCallback(() => {
    const tracks = stream?.subtitles ?? [];
    if (tracks.length === 0) return;
    if (selected) {
      choose(null);
      return;
    }
    // Rallumés : la langue du serveur si elle est offerte, sinon la première piste.
    choose(trailerStartSubtitle(tracks, null, { language }) ?? tracks[0]?.lang ?? null);
  }, [stream, selected, choose, language]);

  const tracks = useMemo<SubtitleTrack[]>(
    () => (stream?.subtitles ?? []).map((s, index) => ({ index, label: s.label, url: backendAbsoluteUrl(s.path), lang: s.lang })),
    [stream],
  );
  const selection = selected === null ? null : tracks.find((t) => t.lang === selected)?.index ?? null;
  const vttUrl = useSanitizedSubtitles({ tracks, selection, src: stream?.url ?? "" });

  return { selected, choose, toggle, vttUrl, language };
}
