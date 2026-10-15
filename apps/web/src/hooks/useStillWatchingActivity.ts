/**
 * Les gestes qui prouvent une présence devant le lecteur web et le lecteur de
 * bureau — rapportés au minuteur de « Vous regardez encore ? »
 * (`useStillWatching`, api-client).
 *
 * Écoutés sur `window` en phase de CAPTURE : un contrôle qui arrête la
 * propagation de son `pointerdown` (barre de lecture, panneaux) ne doit pas
 * rendre le geste invisible. Les gestes portés DANS l'encart lui-même
 * (`[data-still-watching]`) ne comptent pas : en `asking`, un geste vaut
 * réponse « Continuer », et viser « Mettre en pause » au clavier ou au doigt
 * ne doit pas répondre l'inverse.
 *
 * Le simple mouvement du pointeur ne compte qu'EN LECTURE (`none`) : pendant
 * la question, il faut pouvoir amener la souris jusqu'à « Mettre en pause »
 * sans que l'encart s'efface sous le curseur. Il est en outre limité à un
 * rapport par seconde — chaque rapport ne coûte qu'une affectation, mais
 * `pointermove` bat à la fréquence de l'écran.
 */

import { useEffect, useRef } from "react";
import { useStillWatching, type StillWatchingController, type UseStillWatchingOptions } from "@tentacle-tv/api-client";

const POINTER_MOVE_THROTTLE_MS = 1_000;
const PROMPT_SELECTOR = "[data-still-watching]";

/** Le geste vient-il de l'encart lui-même ? */
function fromPrompt(event: Event): boolean {
  const target = event.target as { closest?: (selector: string) => unknown } | null;
  return typeof target?.closest === "function" && target.closest(PROMPT_SELECTOR) !== null;
}

export function useStillWatchingActivity(
  controller: Pick<StillWatchingController, "phase" | "reportActivity">,
): void {
  const latest = useRef(controller);
  latest.current = controller;

  useEffect(() => {
    let lastMove = 0;
    const report = (event: Event) => {
      if (!fromPrompt(event)) latest.current.reportActivity();
    };
    const onMove = (event: Event) => {
      if (latest.current.phase !== "none") return;
      const now = Date.now();
      if (now - lastMove < POINTER_MOVE_THROTTLE_MS) return;
      lastMove = now;
      report(event);
    };
    const passive = { capture: true, passive: true } as const;
    window.addEventListener("pointermove", onMove, passive);
    window.addEventListener("pointerdown", report, passive);
    window.addEventListener("wheel", report, passive);
    window.addEventListener("touchstart", report, passive);
    window.addEventListener("keydown", report, true);
    return () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerdown", report, true);
      window.removeEventListener("wheel", report, true);
      window.removeEventListener("touchstart", report, true);
      window.removeEventListener("keydown", report, true);
    };
  }, []);
}

/** Le contrôleur du lecteur, ses gestes déjà écoutés — ce que montent le lecteur web et celui du bureau. */
export function usePlayerStillWatching(options: UseStillWatchingOptions): StillWatchingController {
  const controller = useStillWatching(options);
  useStillWatchingActivity(controller);
  return controller;
}
