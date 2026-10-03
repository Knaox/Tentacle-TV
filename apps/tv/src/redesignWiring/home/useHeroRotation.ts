import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import {
  heroHoldAfter,
  heroRotateDelay,
  heroRotationActive,
  heroRotationArmed,
  heroRotationRearms,
} from "@tentacle-tv/tv-core";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { useRemoteIntents } from "../../platform/tvos/input";

/**
 * La rotation du héros de l'accueil, façon app TV d'Apple : il avance SEUL,
 * en fondu, même quand le focus est sur l'un de ses boutons. Les boutons
 * restent (clés stables) : le focus ne bouge pas. La règle — l'attente, ce
 * qui la relance, ce qui la suspend, quand rien ne tourne — est celle de
 * tv-core (`hero/rotation.ts`) ; ce crochet tient le minuteur :
 *
 * - le minuteur repart à zéro à chaque geste (les intentions de l'entrée
 *   unique, sauf Retour) et à chaque pas du focus ;
 * - un maintien qui commence le suspend, jusqu'à la suite du maintien ;
 * - rien ne tourne quand le héros n'est pas affiché : écran qui n'est pas
 *   devant, héros défilé hors champ (`shown`), application inactive ;
 * - mouvement réduit : deux fois plus lente — le titre change alors sans
 *   fondu (`motion/`).
 */

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
  const active = heroRotationActive({ shown, appActive, count });
  const delay = heroRotateDelay(reduced);

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
    if (!heroRotationArmed(on, holding)) return;
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

  // Les gestes relancent l'attente ; un maintien la suspend.
  useRemoteIntents(({ intent }) => {
    if (!heroRotationRearms(intent)) return;
    live.current.holding = heroHoldAfter(live.current.holding, intent);
    arm();
  }, active);
  useEffect(() => (active ? focus.subscribe(() => arm()) : undefined), [focus, active, arm]);
}
