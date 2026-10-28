/**
 * Octave (mobile) — l'app est-elle au PREMIER PLAN ? Faux en arrière-plan, écran verrouillé, et pendant
 * l'interruption d'iOS (centre de contrôle, appel) : ce qui ne se voit pas ne doit rien animer.
 */

import { useEffect, useState } from "react";
import { AppState } from "react-native";

export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => sub.remove();
  }, []);
  return active;
}
