import { useEffect, useRef } from "react";
import type { SwipeVerdict } from "@tentacle-tv/api-client";

interface SwipeKeyboardHandlers {
  enabled: boolean;
  onJudge: (verdict: SwipeVerdict) => void;
  onUndo: () => void;
  onToggleInfo: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * Raccourcis de la pile : ← pas pour moi · → j'aime · ↑ coup de cœur ·
 * ↓ passer · Z / Retour arrière / Ctrl+Z annuler · Espace / I synopsis.
 * Jamais pendant une saisie, jamais sur une touche répétée (un appui long ne
 * juge pas dix cartes), et les combinaisons de l'application (Ctrl+K…) passent.
 */
export function useSwipeKeyboard({ enabled, onJudge, onUndo, onToggleInfo }: SwipeKeyboardHandlers): void {
  const handlers = useRef({ onJudge, onUndo, onToggleInfo });
  useEffect(() => {
    handlers.current = { onJudge, onUndo, onToggleInfo };
  }, [onJudge, onUndo, onToggleInfo]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || isTypingTarget(e.target)) return;
      const h = handlers.current;
      const mod = e.ctrlKey || e.metaKey;
      if (mod) {
        if (e.key.toLowerCase() === "z" && !e.shiftKey) {
          e.preventDefault();
          h.onUndo();
        }
        return;
      }
      const act: Record<string, () => void> = {
        ArrowLeft: () => h.onJudge("dislike"),
        ArrowRight: () => h.onJudge("like"),
        ArrowUp: () => h.onJudge("superlike"),
        ArrowDown: () => h.onJudge("skip"),
        Backspace: h.onUndo,
        z: h.onUndo,
        Z: h.onUndo,
        " ": h.onToggleInfo,
        i: h.onToggleInfo,
        I: h.onToggleInfo,
      };
      const run = act[e.key];
      // Espace sur un bouton focalisé : le bouton garde son sens natif.
      if (!run || (e.key === " " && e.target instanceof HTMLButtonElement)) return;
      e.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
