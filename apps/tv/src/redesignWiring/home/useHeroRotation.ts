import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import type { FocusStore } from "../focus/focusStore";
import { useRemoteEvents } from "../remote/remoteEvents";

/**
 * La rotation du héros de l'accueil, façon app TV d'Apple : il avance SEUL,
 * en fondu, toutes les `ROTATE_MS` — même quand le focus est sur l'un de ses
 * boutons. Les boutons restent (clés stables) : le focus ne bouge pas.
 *
 * - Le minuteur repart à zéro à chaque geste : appui, glisser, pas du focus
 *   (une flèche maintenue n'émet que des pas). Qui lit le héros n'en voit
 *   pas le titre changer sous ses yeux ;
 * - un appui MAINTENU (OK) la suspend jusqu'au relâchement ;
 * - rien ne tourne quand le héros n'est pas affiché : écran qui n'est pas
 *   devant, héros défilé hors champ (`shown`), application inactive ;
 * - mouvement réduit : deux fois plus lente — le titre change alors sans
 *   fondu (`motion/`), une fois toutes les seize secondes.
 */

export const ROTATE_MS = 8_000;

export interface HeroRotation {
  focus: FocusStore;
  /** Le nombre de titres : rien ne tourne en dessous de deux. */
  count: number;
  /** Le titre visé : chaque changement relance l'attente. */
  index: number;
  /** Le héros est à l'écran (écran devant, héros dans le champ). */
  shown: boolean;
  onAdvance: () => void;
}

/** L'application est au premier plan et active. */
function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => subscription.remove();
  }, []);
  return active;
}

export function useHeroRotation({ focus, count, index, shown, onAdvance }: HeroRotation): void {
  const reduced = useReducedMotion();
  const appActive = useAppActive();
  const active = shown && appActive && count > 1;
  const delay = reduced ? ROTATE_MS * 2 : ROTATE_MS;

  // L'état du moment, lu par le minuteur et les gestes sans rien redessiner.
  const live = useRef({ active, delay, onAdvance, holding: false });
  live.current.active = active;
  live.current.delay = delay;
  live.current.onAdvance = onAdvance;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const { active: on, holding, delay: wait } = live.current;
    if (!on || holding) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      live.current.onAdvance();
    }, wait);
  }, []);

  // À chaque titre visé, à chaque changement d'état : une attente entière.
  useEffect(() => {
    if (!active) live.current.holding = false;
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [arm, active, delay, index]);

  // Les gestes relancent l'attente ; un appui maintenu la suspend.
  useRemoteEvents((event) => {
    if (event.kind === "press" && event.long) live.current.holding = event.phase === "down";
    arm();
  }, active);
  useEffect(() => (active ? focus.subscribe(() => arm()) : undefined), [focus, active, arm]);
}
