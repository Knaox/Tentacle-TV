import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

interface Options {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  /**
   * Le son vient d'être rétabli à la main. Sert au lecteur à retirer son badge
   * « appuyer pour le son », posé quand la politique d'autoplay a imposé le
   * silence.
   */
  onSonRetabli: () => void;
}

/**
 * Volume, coupure du son, et leur persistance d'une lecture à l'autre.
 * Extraction mécanique de VideoPlayer (limite 300 lignes/fichier),
 * comportement inchangé.
 *
 * `volume` vaut 0 dès que le son est coupé — la bascule le pose elle-même, il
 * n'y a donc pas d'état muet séparé à tenir.
 */
export function usePlayerVolume({ videoRef, onSonRetabli }: Options) {
  const [volume, setVolume] = useState(() => {
    const s = localStorage.getItem("tentacle_player_volume");
    if (s != null) { const v = Number(s); if (!Number.isNaN(v)) return Math.min(1, Math.max(0, v / 100)); }
    return 1;
  });

  // Le rappel change d'identité à chaque rendu du lecteur ; le garder dans une
  // ref laisse les deux handlers stables — ils partent dans les raccourcis
  // clavier, qui réattacheraient sinon leurs écouteurs à chaque image.
  const sonRetabli = useRef(onSonRetabli);
  sonRetabli.current = onSonRetabli;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    // Mute persisté : survit aux changements d'épisode/média (remount).
    if (localStorage.getItem("tentacle_player_muted") === "1") v.muted = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVolumeChange = useCallback((val: number) => {
    setVolume(val);
    const v = videoRef.current;
    if (v) {
      v.volume = val;
      // Monter le volume démute (et efface le mute persisté).
      if (val > 0 && v.muted) {
        v.muted = false;
        try { localStorage.setItem("tentacle_player_muted", "0"); } catch {}
      }
    }
    try { localStorage.setItem("tentacle_player_volume", String(Math.round(val * 100))); } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted) sonRetabli.current();
    try { localStorage.setItem("tentacle_player_muted", v.muted ? "1" : "0"); } catch {}
    setVolume(v.muted ? 0 : 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { volume, handleVolumeChange, handleToggleMute };
}
