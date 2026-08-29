/**
 * Le décompte de l'APERÇU — celui qui rejoue en boucle, dans les réglages.
 *
 * Il n'a rien à voir avec celui du lecteur (`overlayArbiter.ts`), qui compte un
 * vrai temps sur un vrai média. Celui-ci ne sert qu'à montrer ce qu'un réglage
 * fera : il compte, il arrive à zéro, il marque une pause, et il recommence.
 *
 * ⚠️ Une animation infinie se garde par `useInViewport` — la règle du dépôt
 * (CLAUDE.md, « coût GPU »), et elle vaut ici doublement : la page des
 * réglages est longue, l'aperçu passe sous le pli dès qu'on descend, et rien
 * ne justifie qu'un minuteur tourne pour une image que personne ne regarde.
 */

import { useEffect, useRef, useState } from "react";
import { useInViewport } from "../../hooks/useInViewport";

/** Le temps mort entre deux passages — assez pour voir la pilule au repos. */
const PAUSE_MS = 1_200;
const TICK_MS = 250;

export interface PreviewCountdown {
  /** Secondes restantes, ou `null` quand rien ne décompte. */
  seconds: number | null;
  /**
   * Numéro du passage en cours. Sert de `key` : la pilule se remonte à chaque
   * tour, et son balayage rejoue depuis le début.
   */
  cycle: number;
  /** À poser sur le cadre de l'aperçu — c'est lui qu'on observe. */
  ref: React.RefObject<HTMLDivElement | null>;
}

export function usePreviewCountdown(active: boolean, delayMs: number): PreviewCountdown {
  const { ref, visible } = useInViewport<HTMLDivElement>();
  const [seconds, setSeconds] = useState<number | null>(null);
  const [cycle, setCycle] = useState(0);
  // Le départ du tour en cours, en horloge monotone : recalculer le restant à
  // chaque battement évite la dérive d'un compteur qu'on décrémente.
  const startedAt = useRef(0);

  useEffect(() => {
    if (!active || !visible) {
      setSeconds(null);
      return;
    }
    const total = Math.max(0, delayMs);
    startedAt.current = performance.now();
    setSeconds(Math.ceil(total / 1000));

    const timer = setInterval(() => {
      const elapsed = performance.now() - startedAt.current;
      if (elapsed >= total + PAUSE_MS) {
        startedAt.current = performance.now();
        setCycle((n) => n + 1);
        setSeconds(Math.ceil(total / 1000));
        return;
      }
      setSeconds(Math.max(0, Math.ceil((total - elapsed) / 1000)));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [active, visible, delayMs]);

  return { seconds, cycle, ref };
}
