import { isWebDebugEnabled } from "../lib/webDebug";

function wantsReducedMotion(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("reducedmotion") === "1";
  } catch {
    return false;
  }
}

/**
 * `?reducedmotion=1` : fait dire à `matchMedia` que l'utilisateur préfère
 * moins de mouvement — posé AVANT le premier rendu, donc avant que
 * framer-motion ne lise la préférence (`useReducedMotion` la lit une fois).
 * Sert à prouver le mode réduit dans la préviz, que l'outil de capture ne
 * sait pas émuler. Ne couvre que la voie JavaScript : les
 * `@media (prefers-reduced-motion)` de la feuille lisent le vrai réglage.
 * Seulement derrière la porte du débogage du web (`lib/webDebug.ts`).
 */
export function installReducedMotionShim(): void {
  if (!isWebDebugEnabled() || !wantsReducedMotion() || typeof window.matchMedia !== "function") return;

  const original = window.matchMedia.bind(window);
  window.matchMedia = (query: string): MediaQueryList => {
    const list = original(query);
    if (!/prefers-reduced-motion/.test(query)) return list;
    const matches = !/no-preference/.test(query);
    // Les méthodes restent liées à la vraie liste : appelées sur le proxy,
    // elles lèveraient « Illegal invocation ».
    return new Proxy(list, {
      get: (target, prop) => {
        if (prop === "matches") return matches;
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  };
}
