import { useCallback, useEffect, useRef, useState } from "react";
import {
  arm, decideFlash, initialFlashState, type FlashState, type FlashKind,
} from "./playbackFlashState";

export type { FlashKind } from "./playbackFlashState";

export interface PlaybackFlash {
  kind: FlashKind;
  /** Identité du flash, pour que React rejoue l'animation à chaque bascule. */
  id: number;
}

export interface PlaybackFlashControl {
  flash: PlaybackFlash | null;
  /**
   * La PROCHAINE bascule de pause vient du lecteur, pas de l'utilisateur : elle
   * ne doit pas s'annoncer.
   *
   * À appeler juste avant de provoquer soi-même une pause ou une reprise. Une
   * seule bascule est avalée par appel, et l'armement se périme : une pause qui
   * n'arriverait jamais ne peut pas faire taire la suivante, celle que
   * l'utilisateur aura demandée.
   */
  ignoreNextToggle: () => void;
}

/** Le temps que le badge reste à l'écran, animation de sortie comprise. */
const DURATION_MS = 700;

/**
 * Le retour visuel des bascules du lecteur — pendant du badge « +30s ».
 *
 * # Pourquoi un hook et pas un simple booléen
 *
 * Ce qu'on montre n'est pas un ÉTAT mais un ÉVÈNEMENT : « on vient de mettre en
 * pause », « on vient de couper le son ». Rendre l'icône tant que la vidéo est
 * en pause la laisserait plantée au milieu de l'image pendant qu'on lit le
 * synopsis ; la lier à l'état seul ne marche donc pas.
 *
 * # Toutes les pauses ne sont pas des pauses
 *
 * C'est le fond du sujet, et le défaut que ceci corrige : le badge se déduit de
 * l'état `paused`, or le LECTEUR met lui-même en pause pour des raisons qui n'ont
 * rien à voir avec une intention de l'utilisateur.
 *
 * En faisant glisser la barre de progression, le lecteur desktop met en pause le
 * temps du glissement puis reprend à la fin — délibérément, pour ne pas courir
 * après mpv à chaque pixel (cf. `useDesktopSeekbar`). Vu de l'état, ce sont deux
 * bascules ; vues à l'écran, c'étaient deux badges en pleine image alors qu'on
 * cherchait simplement un passage. Un changement de source — bascule en
 * transcodage sur un saut lointain — fait de même : mpv recharge, donc il repasse
 * par la pause.
 *
 * Deux portes, et elles ne se recouvrent pas :
 *  • `ignoreNextToggle` — un armement COMPTÉ, pour une cause ponctuelle et
 *    connue à l'avance (le glissement) ; exact, sans réglage de délai ;
 *  • `inert` — un état, pour une cause qui DURE (le rechargement d'une source) ;
 *    tant qu'il est vrai, l'état de référence est resynchronisé sans rien
 *    annoncer, si bien que la sortie de cet état ne produit pas de badge non plus.
 *
 * La décision elle-même vit dans `playbackFlashState`, en fonction pure et
 * testée : quatre règles s'y croisent, dont celle du démarrage — un lecteur qui
 * monte passe par la pause puis par la lecture, et cette seconde étape affichait
 * une icône à l'ouverture de chaque film.
 *
 * Un seul badge à la fois : deux bascules simultanées sont si rares que le
 * dernier gagne, plutôt que d'empiler deux icônes au même endroit.
 */
export function usePlaybackFlash(
  paused: boolean,
  muted: boolean,
  inert = false,
): PlaybackFlashControl {
  const [flash, setFlash] = useState<PlaybackFlash | null>(null);
  const state = useRef<FlashState>(initialFlashState);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const ignoreNextToggle = useCallback(() => {
    state.current = arm(state.current, Date.now());
  }, []);

  useEffect(() => {
    const suite = decideFlash(state.current, { paused, muted, inert, now: Date.now() });
    state.current = suite.state;
    if (suite.kind === null) return;

    counter.current += 1;
    setFlash({ kind: suite.kind, id: counter.current });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(null), DURATION_MS);
  }, [paused, muted, inert]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { flash, ignoreNextToggle };
}
