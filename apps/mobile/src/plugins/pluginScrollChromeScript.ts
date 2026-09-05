import { SCROLL_CHROME_TUNING } from "@/components/navigation/scrollChrome";

/**
 * Le défilement d'une page d'extension pilote le chrome natif (en-tête, barre)
 * comme celui d'un onglet natif. La page calcule elle-même l'hystérésis —
 * mêmes seuils que `useScrollChromeHandler` — et ne poste un message
 * (`SCROLL_CHROME`) qu'au CHANGEMENT d'état : rien ne traverse le pont à
 * chaque image.
 *
 * Écoute en capture : les pages d'extension défilent souvent dans un bloc
 * `overflow: auto` interne, invisible pour le document. Un offset par
 * défileur (WeakMap) : changer de zone ne fabrique pas de faux delta. Un
 * calcul par image (requestAnimationFrame). `reset()` réaligne la page sur un
 * chrome que le natif vient de redéployer (arrivée sur l'onglet).
 *
 * Aucune séquence `</script>` ici : le script est inliné dans le document.
 */
export function buildScrollChromeScript(): string {
  const tuning = JSON.stringify({ nearTop: SCROLL_CHROME_TUNING.showNearTop, delta: SCROLL_CHROME_TUNING.delta });
  return `
    (function () {
      var T = ${tuning};
      var collapsed = false, last = new WeakMap(), raf = 0, pending = null;
      function post(v) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: "SCROLL_CHROME", collapsed: v }));
        }
      }
      function offsetOf(t) {
        return t === document ? (window.scrollY || document.documentElement.scrollTop || 0) : t.scrollTop;
      }
      function evaluate(t) {
        var y = offsetOf(t), prev = last.get(t);
        last.set(t, y);
        if (prev === undefined) return;
        var dy = y - prev, next = collapsed;
        if (y < T.nearTop) next = false;
        else if (dy > T.delta) next = true;
        else if (dy < -T.delta) next = false;
        if (next !== collapsed) { collapsed = next; post(next); }
      }
      document.addEventListener("scroll", function (e) {
        pending = e.target === document ? document : e.target;
        if (!raf) raf = requestAnimationFrame(function () { raf = 0; if (pending) evaluate(pending); });
      }, { capture: true, passive: true });
      window.__tentacleScrollChrome = {
        reset: function () { collapsed = false; last = new WeakMap(); }
      };
    })();
  `;
}
