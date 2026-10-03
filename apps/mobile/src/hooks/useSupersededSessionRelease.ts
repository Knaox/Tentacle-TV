import { useEffect, useRef } from "react";
import { recordEncodingSession } from "../lib/transcodeSession";

const DBG = "[Tentacle:Playback]";

/**
 * Une session en supplante une autre à CHAQUE `fetchPlaybackInfo` : palier de
 * qualité, piste audio en transcodage, sous-titre bitmap à incruster, reprise
 * après erreur de codec, épisode suivant. Jellyfin ouvre alors un nouvel
 * encodage sans fermer le précédent — l'ancien ffmpeg continue d'écrire ses
 * fichiers jusqu'au bout du film. On le libère à l'instant où son remplaçant
 * apparaît, comme le fait le web (cf. `WatchWeb.tsx`).
 *
 * La comparaison porte sur DEUX identifiants explicites, jamais sur un ref
 * partagé : c'est ce qui garantit qu'on ne tue pas la session qui vient de
 * naître. Extrait de `usePlayerPlayback` (limite de 300 lignes).
 */
export function useSupersededSessionRelease(
  playSessionId: string | null,
  baseUrl: string,
  killTranscode: (sessionId: string) => Promise<unknown> | void,
): void {
  const previousSessionRef = useRef<string | null>(null);
  useEffect(() => {
    const currentSession = playSessionId;
    if (!currentSession) return;
    const previousSession = previousSessionRef.current;
    previousSessionRef.current = currentSession;
    // Trace sur disque, relue au lancement suivant : c'est le seul recours
    // contre une application tuée en pleine lecture (cf. transcodeSession).
    recordEncodingSession(currentSession, baseUrl);
    if (!previousSession || previousSession === currentSession) return;
    console.log(DBG, "session supplantée — ancien transcodage libéré", { previousSession, currentSession });
    void killTranscode(previousSession);
  }, [playSessionId, killTranscode, baseUrl]);
}
