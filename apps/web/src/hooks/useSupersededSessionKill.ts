import { useEffect, useRef } from "react";
import { wtLog } from "../watchTogether/wtLog";

/**
 * Une session de lecture qui en supplante une autre laisse un ffmpeg orphelin.
 *
 * Le serveur attribue un PlaySessionId NEUF à chaque PlaybackInfo, et y
 * accroche un transcodage distinct. Le lecteur, lui, n'en lit qu'un : dès que
 * `streamUrl` change, hls.js est détruit et repart sur la nouvelle URL. Le
 * précédent ffmpeg n'a alors plus un seul client — mais Jellyfin ne le sait
 * pas, et le garde vivant jusqu'à son minuteur d'inactivité (« Transcoding
 * kill timer », de l'ordre de la minute). Pendant tout ce temps le serveur
 * compte DEUX flux actifs pour un seul spectateur, avec deux ffmpeg sur le
 * dos — c'est le « 2 appareils au lieu d'1 » du tableau de bord.
 *
 * WatchDesktop tue l'ancien encodage à la main dans chacun de ses handlers.
 * Ici on le fait à la source : ce n'est pas le changement de qualité qui rend
 * un transcodage caduc, c'est le fait qu'un autre ait pris sa place. Une
 * seule garde couvre donc TOUS les chemins de reconstruction — qualité, piste
 * audio, incrustation de sous-titre, replis MKV et PGS, et le second
 * PlaybackInfo du démarrage quand les préférences arrivent après coup.
 *
 * Les effets des enfants s'exécutent AVANT ceux du parent : quand celui-ci
 * tourne, `useVideoSource` a déjà basculé sur la nouvelle source. On ne tue
 * jamais un encodage encore en cours de lecture.
 */
export function useSupersededSessionKill(playSessionId: string, killTranscode: (playSessionId: string) => Promise<unknown> | void): void {
  const previousSessionRef = useRef<string | null>(null);
  useEffect(() => {
    // Seul un identifiant RÉEL est mémorisé : `pbInfo.reset()` (changement
    // d'épisode) repasse par la chaîne vide, et l'oublier ici perdrait la trace
    // de l'encodage à tuer juste avant qu'il ne le soit.
    if (!playSessionId) return;
    const previous = previousSessionRef.current;
    previousSessionRef.current = playSessionId;
    if (!previous || previous === playSessionId) return;
    wtLog("session", "session supplantée → ancien transcodage tué", { previous, playSessionId });
    void killTranscode(previous);
  }, [playSessionId, killTranscode]);
}
