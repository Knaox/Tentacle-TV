import { useEffect, useRef } from "react";

/**
 * Compteur d'images — **dev, ou build livré avec `?fps` dans l'URL**.
 *
 * Pourquoi il existe : « ça manque de fluidité » n'est pas mesurable, et on ne
 * peut pas optimiser ce qu'on ne mesure pas. L'inspecteur Web de Safari donne
 * une ventilation bien plus fine, mais il ne s'attache qu'aux builds de debug —
 * ce compteur-ci fonctionne AUSSI sur l'app livrée, ce qui en fait le seul
 * instrument permettant une comparaison avant/après honnête.
 *
 * Ce qu'il affiche :
 *   • i/s      — images par seconde déduites de la médiane. Sur un écran
 *                ProMotion, ~120 est la cible ; un plafond net à 60 signalerait
 *                une limite de plateforme, pas un problème de contenu.
 *   • p50/p95  — durée d'une image, en ms. C'est le p95 qui se RESSENT : la
 *                médiane peut être bonne pendant que le défilement accroche.
 *   • >8,3ms   — part des images ayant dépassé le budget d'un écran 120 Hz.
 *   • pire     — l'image la plus longue depuis le dernier rafraîchissement.
 *
 * Il n'appelle jamais `setState` : il écrit directement dans le nœud via une
 * ref. Un compteur qui déclenche un rendu React par image mesurerait surtout
 * lui-même.
 *
 * ⚠️ EFFET OBSERVATEUR, à connaître avant d'interpréter quoi que ce soit :
 *
 * 1. Sa boucle `requestAnimationFrame` ne s'arrête jamais. Elle force donc un
 *    cycle de rendu à chaque image, y compris sur une page parfaitement
 *    immobile qui, sans lui, ne demanderait rien. Il fausse par construction
 *    toute mesure de consommation au repos : pour `powermetrics`, le
 *    DÉSACTIVER.
 * 2. En développement il ne mesure PAS l'application réelle. React y double
 *    chaque rendu (StrictMode, cf. main.tsx), le code n'est ni minifié ni
 *    optimisé, et Vite sert les modules un par un. Comptez un facteur deux à
 *    cinq sur tout ce qui touche au rendu React — un survol de carte y coûte
 *    plusieurs fois son prix réel. Les seuls chiffres qui comptent viennent
 *    d'un build de production.
 */

/** Fenêtre glissante — environ deux secondes à 120 Hz. */
const WINDOW = 240;
/** Cadence de rafraîchissement de l'affichage. Assez lent pour rester lisible. */
const REFRESH_MS = 500;
/** Budget d'une image sur un écran 120 Hz. */
const BUDGET_120_MS = 1000 / 120;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

export function FrameMeter() {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const deltas: number[] = [];
    let raf = 0;
    let last = performance.now();
    let lastPaint = last;
    let worst = 0;

    const tick = (now: number) => {
      const dt = now - last;
      last = now;

      // On écarte les valeurs aberrantes : première image après le montage, et
      // reprise après une mise en arrière-plan (l'onglet caché suspend la rAF,
      // le delta se compte alors en secondes et écraserait toute la fenêtre).
      if (dt > 0 && dt < 1000) {
        deltas.push(dt);
        if (deltas.length > WINDOW) deltas.shift();
        if (dt > worst) worst = dt;
      }

      if (now - lastPaint >= REFRESH_MS) {
        lastPaint = now;
        const el = boxRef.current;
        if (el && deltas.length > 10) {
          const sorted = [...deltas].sort((a, b) => a - b);
          const p50 = percentile(sorted, 50);
          const p95 = percentile(sorted, 95);
          const over = deltas.filter((d) => d > BUDGET_120_MS).length;
          const pct = Math.round((over / deltas.length) * 100);
          el.textContent =
            `${(1000 / p50).toFixed(0)} i/s · p50 ${p50.toFixed(1)} ms · ` +
            `p95 ${p95.toFixed(1)} ms · >8,3 ms ${pct}% · pire ${worst.toFixed(0)} ms`;
          worst = 0;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={boxRef}
      aria-hidden
      style={{
        position: "fixed",
        bottom: 8,
        left: 8,
        zIndex: 2147483647,
        pointerEvents: "none",
        padding: "4px 8px",
        borderRadius: 6,
        background: "rgba(0,0,0,0.78)",
        color: "#7CFFB2",
        font: "600 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      mesure…
    </div>
  );
}

/** Clé d'activation persistante — le seul levier utilisable dans l'app native. */
const STORAGE_KEY = "tentacle_fps";

/**
 * Vrai si le compteur doit être monté. Jamais par défaut sur un build livré.
 *
 * Trois portes d'entrée, dans l'ordre :
 *  • le mode développement ;
 *  • `?fps` dans l'URL — utile dans un navigateur, inaccessible dans l'app
 *    native où l'on ne peut pas taper d'adresse ;
 *  • `localStorage.tentacle_fps = "1"` — la porte de l'app empaquetée. À poser
 *    depuis l'inspecteur Web de Safari (Développement → Tentacle TV), qui est
 *    attaché sur les builds de debug, puis recharger avec Cmd+R.
 */
export function frameMeterEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    // `?fps` ARME le compteur de façon persistante. Sans ça, il disparaissait
    // à la première navigation : React Router réécrit l'URL, le paramètre est
    // perdu, et l'app native ne permet pas de le retaper. On ne pouvait donc
    // mesurer que l'écran de connexion — inutile.
    if (new URLSearchParams(window.location.search).has("fps")) {
      localStorage.setItem(STORAGE_KEY, "1");
      return true;
    }
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Désarme le compteur : `window.tentacleFpsOff()` depuis la console. */
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).tentacleFpsOff = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    } catch {
      /* stockage indisponible */
    }
  };
}
