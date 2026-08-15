import { useEffect, useRef, type MutableRefObject } from "react";
import type { AudioTrack, SubtitleTrack } from "../components/player/videoPlayer.types";
import { apparier, rangDe, type PisteNative } from "./appariementPistes";
import { pistePubliable } from "../lib/deviceProfile/pistesLecteur";

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

/** `HAVE_METADATA` : la liste des pistes est arrêtée, on peut conclure. */
const METADONNEES_PRETES = 1;

/**
 * Délai avant de conclure qu'une piste manque, en millisecondes.
 *
 * `loadedmetadata` peut partir avant que la pile média ait fini de publier ses
 * pistes — c'est déjà la raison du « ceinture et bretelles » plus bas. Conclure
 * dans la foulée redemanderait une session serveur, donc couperait le flux
 * pendant une seconde, pour une piste arrivée cinquante millisecondes plus
 * tard. Un seul minuteur, annulé dès qu'une bascule aboutit.
 */
const DELAI_VERDICT_MS = 700;

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

  // Une session déjà redemandée ne se redemande pas : sans ce garde-fou, un
  // serveur qui rendrait la même lecture directe pour la piste voulue ferait
  // repartir une session toutes les 700 ms, indéfiniment. La clé porte la
  // source, donc une session neuve rouvre le droit de conclure.
  const dejaSignale = useRef<string | null>(null);

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

    let verdict: ReturnType<typeof setTimeout> | null = null;
    const annulerVerdict = () => {
      if (verdict === null) return;
      clearTimeout(verdict);
      verdict = null;
    };

    const appliquer = () => {
      const rang = rangDe(
        apparier(listerNatives(elemTracks), audioTracks, pistePubliable),
        audioTracks,
        currentAudio,
      );
      // Aucune écriture tant que les métadonnées ne sont pas là. C'est plus
      // strict que l'ancien seuil de longueur, et pour la même raison :
      // réaffirmer `enabled` pendant que la chaîne audio s'initialise fait
      // taire le téléviseur.
      const pret = v.readyState >= METADONNEES_PRETES;
      if (!pret) return;
      if (rang !== null) {
        annulerVerdict();
        activerPisteAudio(elemTracks, rang);
        return;
      }
      if (!pisteIntrouvable(pret, rang)) return;
      // La liste est arrêtée et la piste n'y est pas : c'est au serveur de la
      // fournir. On laisse encore un instant au démultiplexeur, cf. le délai.
      const cle = `${src}|${currentAudio}`;
      if (dejaSignale.current === cle || verdict !== null) return;
      verdict = setTimeout(() => {
        verdict = null;
        dejaSignale.current = cle;
        surPisteIntrouvable?.();
      }, DELAI_VERDICT_MS);
    };

    appliquer();
    // Ceinture et bretelles : certaines implémentations peuplent la liste sans
    // émettre `addtrack`, et `loadedmetadata` est alors le seul signal.
    elemTracks.addEventListener?.("addtrack", appliquer);
    v.addEventListener("loadedmetadata", appliquer);
    return () => {
      annulerVerdict();
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
  [i: number]: { enabled: boolean; id?: string; label?: string; language?: string };
  addEventListener?: (type: string, ecouteur: () => void) => void;
  removeEventListener?: (type: string, ecouteur: () => void) => void;
}

/**
 * Copie la liste vivante en données inertes, pour que l'appariement reste pur.
 *
 * `AudioTrackList` est une collection vivante indexée : elle ne porte ni `map`
 * ni `filter`, et la parcourir depuis un module pur reviendrait à lui donner
 * accès au DOM.
 */
export function listerNatives(natives: ListePistesNatives): PisteNative[] {
  const liste: PisteNative[] = [];
  for (let i = 0; i < natives.length; i++) {
    const { id, label, language } = natives[i];
    liste.push({ id, label, language });
  }
  return liste;
}

/**
 * N'active que la piste de rang `rang`, et rend si l'écriture était nécessaire.
 *
 * Le rang vient de l'appariement, jamais d'un calcul sur les index : c'est
 * précisément ce que ce module ne sait pas faire, puisqu'il ne voit pas quelles
 * pistes le démultiplexeur a omises.
 */
export function activerPisteAudio(natives: ListePistesNatives, rang: number): boolean {
  if (rang < 0 || rang >= natives.length) return false;
  // RIEN À FAIRE si la piste voulue est déjà la seule active — et surtout, rien
  // à écrire. Sur le téléviseur, réaffirmer `enabled` sur la piste courante
  // pendant que la chaîne audio s'initialise la fait taire : le film démarrait
  // muet, et il fallait changer de piste pour retrouver le son. Le cas est le
  // plus fréquent de tous (la piste préférée est souvent celle du conteneur),
  // et il ne demandait aucune écriture.
  if (dejaSeuleActive(natives, rang)) return false;
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
 * Faut-il demander la piste au serveur ?
 *
 * Deux échecs se ressemblent et n'ont rien à voir : une liste que le
 * démultiplexeur n'a pas fini de peupler, et une piste qu'il ne publiera
 * jamais. Seul `readyState` les sépare — **surtout pas la longueur de la
 * liste**, et c'était le défaut : sur un MKV portant un DTS français et un
 * TrueHD anglais, webOS ne publie qu'une entrée. Le test « moins de deux
 * pistes, donc liste non peuplée » y était vrai à jamais, si bien que demander
 * l'anglais ne faisait rien du tout — ni bascule, ni session serveur, ni
 * message. Le film restait en français.
 */
export function pisteIntrouvable(pret: boolean, rang: number | null): boolean {
  return pret && rang === null;
}
