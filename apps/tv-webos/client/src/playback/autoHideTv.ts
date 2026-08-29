import { useCallback, useEffect } from "react";
import { showOsd, setPlaying, useTvPlayerState } from "@tentacle-tv/tv-core";

/**
 * L'auto-masquage des commandes, version téléviseur.
 *
 * Substitué à `apps/web/src/hooks/useControlsAutoHide.ts`, et **c'est la seule
 * prise sur l'enveloppe**. `VideoPlayer` place les commandes dans un conteneur
 * qui passe en `opacity-0 pointer-events-none` selon la valeur que ce hook
 * rend ; sans substitution, l'habillage du téléviseur s'éteindrait au bout de
 * trois secondes et ne reviendrait jamais — le hook du web n'est réarmé que par
 * `onMouseMove`, et une télécommande n'en produit pas.
 *
 * Second défaut, plus discret : l'effet du hook web réaffiche les commandes à
 * CHAQUE bascule lecture/pause. Or le curseur fantôme met la vidéo en pause.
 * L'habillage qu'on vient d'éteindre pour entrer en déplacement se rallumerait
 * à l'image suivante.
 *
 * Ici, la visibilité vient du magasin, qui est aussi ce que lisent le
 * contrôleur de touches et le moteur de focus : ils ne peuvent pas diverger. Et
 * `showControls` reste vrai pendant le déplacement, ce qui laisse la surcouche
 * de scrub visible sans qu'il faille un portail ni substituer `VideoPlayer`.
 *
 * `DesktopPlayer` importe le même hook et sera donc substitué lui aussi dans ce
 * bundle. Sans effet : `Watch` ne rend le lecteur mpv que si la coquille le
 * supporte, ce qu'un téléviseur ne fait pas.
 */
export function useControlsAutoHide(playing: boolean): {
  showControls: boolean;
  scheduleHide: () => void;
} {
  const state = useTvPlayerState();

  useEffect(() => {
    setPlaying(playing);
  }, [playing]);

  // Le web appelle ceci sur `onMouseMove` — donc sous le pointeur de la Magic
  // Remote, et là seulement. Les touches passent par le contrôleur, qui écrit
  // dans le même magasin.
  const scheduleHide = useCallback(() => {
    showOsd();
  }, []);

  return { showControls: state.mode !== "idle", scheduleHide };
}
