import { useEffect, type MutableRefObject } from "react";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";

/** Sous-titres gravés dans une image, qu'aucun `<track>` ne sait afficher. */
const SOUS_TITRES_IMAGE = /pgs|dvd|dvb|vobsub/i;

interface Options {
  streams: JfStream[];
  /** L'utilisateur a choisi lui-même sa piste : ne rien écraser. */
  audioOverrideRef: MutableRefObject<boolean>;
  subtitleOverrideRef: MutableRefObject<boolean>;
  /** Les préférences serveur ont pris la main : elles priment sur les défauts. */
  prefsApplied: MutableRefObject<boolean>;
  setAudioIndex: (index: number) => void;
  setSubtitleIndex: (index: number | null) => void;
  /**
   * Choisir un sous-titre image coûterait-il un ré-encodage ?
   *
   * Vrai quand le décodeur PGS du client a échoué — ou, sur ce serveur, quand
   * Jellyfin refuse d'extraire le `.sup` : l'incrustation serveur prend alors le
   * relais et RECOMPRESSE l'image entière.
   *
   * Ce n'est PAS l'inverse de « le client sait dessiner un PGS ». Sous mpv, il
   * ne sait pas — c'est mpv qui les rend, nativement, sans rien coûter. D'où un
   * nom qui dit le COÛT et non la capacité : la confusion entre les deux est
   * exactement ce qui aurait fait basculer le bureau vers un sous-titre texte
   * qu'il n'avait aucune raison de préférer.
   */
  incrustationCouteuse?: boolean;
}

/**
 * Le sous-titre par défaut, choisi sans faire recompresser l'image.
 *
 * Un fichier peut proposer la même langue en texte ET en image. Prendre celui
 * que le conteneur marque « par défaut » revient souvent à prendre l'image — et
 * quand le client ne sait pas la dessiner, le serveur doit l'incruster, donc
 * ré-encoder. Un film 4K y perd sa plage dynamique pour un sous-titre que le
 * fichier proposait aussi en texte.
 *
 * On ne retire donc rien : on choisit, à langue égale, la piste qui ne coûte
 * pas l'image. Les fichiers qui n'ont que de l'image gardent leur sous-titre —
 * l'arbitrage y est réel, et il appartient à celui qui regarde.
 */
export function sousTitreParDefaut(streams: JfStream[], incrustationCouteuse: boolean): number | null {
  const sousTitres = streams.filter((s) => s.Type === "Subtitle");
  const defaut = sousTitres.find((s) => s.IsDefault);
  if (!defaut) return null;
  if (!incrustationCouteuse || !SOUS_TITRES_IMAGE.test(defaut.Codec ?? "")) return defaut.Index ?? null;

  // Même langue, mais en texte : Jellyfin le sert en piste séparée, sans
  // toucher à l'image. `Language` peut manquer — on ne devine pas au titre.
  const texte = sousTitres.find(
    (s) => s.Language && s.Language === defaut.Language && !SOUS_TITRES_IMAGE.test(s.Codec ?? ""),
  );
  return texte?.Index ?? defaut.Index ?? null;
}

/**
 * Réconcilie les pistes sur les valeurs par défaut du fichier, dès que les
 * `MediaStreams` arrivent — sauf si l'utilisateur ou les préférences serveur
 * ont déjà tranché.
 *
 * Le sous-titre passe par `sousTitreParDefaut`, qui évite de choisir une piste
 * image quand elle coûterait un ré-encodage et qu'un texte de même langue existe.
 */
export function useDefaultTracks({
  streams, audioOverrideRef, subtitleOverrideRef, prefsApplied,
  setAudioIndex, setSubtitleIndex, incrustationCouteuse = false,
}: Options): void {
  useEffect(() => {
    if (streams.length > 0 && !audioOverrideRef.current && !prefsApplied.current) {
      const defAudio = streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
        ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0;
      setAudioIndex(defAudio);
    }
  }, [streams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (streams.length > 0 && !prefsApplied.current && !subtitleOverrideRef.current) {
      const defSub = sousTitreParDefaut(streams, incrustationCouteuse);
      if (defSub != null) setSubtitleIndex(defSub);
    }
  }, [streams, incrustationCouteuse]); // eslint-disable-line react-hooks/exhaustive-deps
}
