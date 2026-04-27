import { useEffect } from "react";
import { isTauri, warmupMpv } from "./useDesktopPlayer";

/**
 * Précharge mpv en arrière-plan dès que possible après le mount de l'app desktop.
 *
 * Pourquoi : sur Windows, le premier `api.init()` prend 1-3 s (chargement de
 * la DLL libmpv + alloc du contexte OpenGL via WebView2) — ce qui produisait
 * un loader infini sur le tout premier média de la session si l'utilisateur
 * cliquait avant la fin de l'init. macOS n'a pas ce problème (custom Rust API
 * via WKWebView quasi-immédiate), mais le warmup y est inoffensif.
 *
 * Stratégie : appel via `requestIdleCallback` quand dispo, sinon `setTimeout`,
 * pour ne pas voler le main thread pendant le boot UI. Le warmup est idempotent
 * (cf. `warmupDone` dans useDesktopPlayer) — on peut le brancher partout.
 */
export function useMpvWarmup(): void {
  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;

    const fire = () => {
      if (cancelled) return;
      // Le résultat est intentionnellement ignoré : la fonction logge en interne
      // et le résultat ne pilote aucune UI — c'est de l'optimisation pure.
      warmupMpv().catch(() => {});
    };

    // Préfère requestIdleCallback : laisse le boot UI se terminer en priorité.
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;

    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(fire, { timeout: 3000 });
    } else {
      // Fallback : 1.5 s après mount — l'app a généralement fini son cascade
      // d'animations et les requêtes critiques sont parties.
      timeoutId = setTimeout(fire, 1500);
    }

    return () => {
      cancelled = true;
      if (idleId != null && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, []);
}
