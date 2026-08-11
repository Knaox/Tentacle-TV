import { useEffect, type MutableRefObject } from "react";
import type { AudioTrack, SubtitleTrack } from "../components/player/videoPlayer.types";

interface UseNativeMediaTracksOptions {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  src: string;
  subtitleTracks: SubtitleTrack[];
  currentSubtitle: number | null;
  audioTracks: AudioTrack[];
  currentAudio: number;
  isDirectPlay: boolean;
  /**
   * La piste voulue n'existe pas côté lecteur : il faut la demander au serveur.
   *
   * Facultatif — sans lui, le comportement est celui d'avant : on n'insiste pas,
   * et la lecture reste sur la piste courante.
   */
  surPisteIntrouvable?: () => void;
}

export function useNativeMediaTracks({
  videoRef, src, subtitleTracks, currentSubtitle, audioTracks, currentAudio, isDirectPlay,
  surPisteIntrouvable,
}: UseNativeMediaTracksOptions): void {
  // Subtitle track visibility — re-apply after source change and when tracks load.
  // Uses "disabled" (fully off) for non-selected tracks to prevent hls.js interference
  // (hls.js can reset "hidden" tracks to "showing" — issue #4032).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const apply = () => {
      const targetIdx = currentSubtitle != null
        ? subtitleTracks.findIndex((s) => s.index === currentSubtitle) : -1;
      for (let i = 0; i < v.textTracks.length; i++) {
        v.textTracks[i].mode = (i === targetIdx) ? "showing" : "disabled";
      }
    };
    apply();
    // Re-apply when browser finishes loading <track> elements after source change
    v.textTracks.addEventListener("addtrack", apply);
    return () => v.textTracks.removeEventListener("addtrack", apply);
  }, [currentSubtitle, subtitleTracks, src]);

  // jellyfin-web pattern (plugin.js:setAudioStreamIndex): In Direct Play, switch
  // audio tracks natively via HTML5 audioTracks API. This avoids URL rebuild and
  // stream interruption. Supported in Firefox/Safari and on webOS (mesuré sur une
  // C3 : `"audioTracks" in video` y répond vrai) ; Chrome requires transcoding
  // fallback (handled by Watch.tsx rebuilding the URL when native switch unavailable).
  //
  // La bascule se RÉAPPLIQUE, comme celle des sous-titres juste au-dessus, et
  // pour la même raison. Elle ne le faisait pas, et c'est ce qui rendait les
  // préférences de piste inopérantes au premier coup : cet effet tourne au
  // montage de la balise, donc AVANT `loadedmetadata`, donc avant que le
  // démultiplexeur ait peuplé `v.audioTracks`. Il sortait alors sur une liste
  // vide — et comme `currentAudio` portait déjà la valeur préférée et ne
  // bougeait plus, plus rien ne le rejouait. Le lecteur restait sur la piste du
  // conteneur, l'interface affichait la bonne, et il fallait cliquer une autre
  // piste pour que la course se dénoue.
  //
  // Deuxième chemin réparé au passage : `load()` — celui de la veille de gel du
  // téléviseur — vide les listes de pistes. Les sous-titres revenaient par leur
  // `addtrack`, la piste audio choisie était perdue à chaque relance.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isDirectPlay) return;
    // HTMLMediaElement.audioTracks is not in standard TS lib — access via type cast.
    const elemTracks = (v as HTMLVideoElement & { audioTracks?: ListePistesNatives }).audioTracks;
    if (!elemTracks) return;

    const appliquer = () => {
      if (activerPisteAudio(elemTracks, audioTracks, currentAudio)) return;
      // On ne renonce QUE sur une liste peuplée : autrement c'est le
      // démultiplexeur qui n'a pas fini, et le signal suivant nous rappellera.
      if (pisteIntrouvable(elemTracks, audioTracks, currentAudio)) surPisteIntrouvable?.();
    };
    appliquer();
    // Ceinture et bretelles : certaines implémentations peuplent la liste sans
    // émettre `addtrack`, et `loadedmetadata` est alors le seul signal.
    elemTracks.addEventListener?.("addtrack", appliquer);
    v.addEventListener("loadedmetadata", appliquer);
    return () => {
      elemTracks.removeEventListener?.("addtrack", appliquer);
      v.removeEventListener("loadedmetadata", appliquer);
    };
    // `surPisteIntrouvable` volontairement hors dépendances : l'appelant le
    // reconstruit à chaque rendu, et le remettre ici rejouerait la bascule sans
    // raison — écrire `enabled` pour rien fait taire le téléviseur.
  }, [currentAudio, isDirectPlay, audioTracks, src]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** `HTMLMediaElement.audioTracks` n'est pas déclaré par la lib TS standard. */
export interface ListePistesNatives {
  readonly length: number;
  [i: number]: { enabled: boolean };
  addEventListener?: (type: string, ecouteur: () => void) => void;
  removeEventListener?: (type: string, ecouteur: () => void) => void;
}

/**
 * Active la piste demandée sur l'élément, et rend si elle l'a été.
 *
 * L'index Jellyfin est traduit en RANG dans la liste native : `audioTracks` ne
 * porte que les flux de type Audio, dans l'ordre du fichier — le même que celui
 * du démultiplexeur. Une liste de moins de deux entrées n'est pas un refus,
 * c'est une liste pas encore peuplée : on ne touche à rien et on attend le
 * signal suivant.
 */
export function activerPisteAudio(
  natives: ListePistesNatives, pistes: AudioTrack[], voulue: number,
): boolean {
  if (natives.length < 2) return false;
  const rang = pistes.findIndex((t) => t.index === voulue);
  if (rang === -1 || rang >= natives.length) return false;
  // `false` ci-dessus recouvre DEUX choses très différentes — une liste pas
  // encore peuplée et une piste réellement absente — et l'appelant qui doit
  // décider de renégocier a besoin de les distinguer : cf. `pisteIntrouvable`.
  // RIEN À FAIRE si la piste voulue est déjà la seule active — et surtout, rien
  // à écrire. Sur le téléviseur, réaffirmer `enabled` sur la piste courante
  // pendant que la chaîne audio s'initialise la fait taire : le film démarrait
  // muet, et il fallait changer de piste pour retrouver le son. Le cas est le
  // plus fréquent de tous (la piste préférée est souvent celle du conteneur),
  // et il ne demandait aucune écriture.
  if (dejaSeuleActive(natives, rang)) return true;
  for (let i = 0; i < natives.length; i++) natives[i].enabled = (i === rang);
  return true;
}

function dejaSeuleActive(natives: ListePistesNatives, rang: number): boolean {
  for (let i = 0; i < natives.length; i++) {
    if (natives[i].enabled !== (i === rang)) return false;
  }
  return true;
}

/**
 * La liste est peuplée, et la piste voulue n'y est pas.
 *
 * C'est le seul cas où renoncer à la bascule native veut dire quelque chose. Une
 * liste de moins de deux entrées n'est pas un refus mais une liste pas encore
 * peuplée — le démultiplexeur n'a pas fini — et conclure là-dessus renégocierait
 * une session à chaque montage de lecteur, pour rien.
 *
 * Le cas réel : une piste présente dans le conteneur que la puce ne sait pas
 * décoder. Le démultiplexeur ne la publie pas, le serveur, lui, l'aurait
 * transcodée. Il faut alors le lui demander.
 */
export function pisteIntrouvable(
  natives: ListePistesNatives, pistes: AudioTrack[], voulue: number,
): boolean {
  if (natives.length < 2) return false;
  const rang = pistes.findIndex((t) => t.index === voulue);
  return rang === -1 || rang >= natives.length;
}
