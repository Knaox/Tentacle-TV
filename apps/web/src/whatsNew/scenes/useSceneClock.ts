import { useEffect, useState } from "react";

interface SceneClockOptions {
  active: boolean;
  reduced: boolean;
}

export interface SceneClock {
  /** Index du pas courant, de 0 à `stepsMs.length - 1`. */
  step: number;
  /** Nombre de boucles achevées — la clé de remontage du canevas. */
  cycle: number;
}

/**
 * L'horloge d'une scène : une chaîne de `setTimeout`, un pas à la fois,
 * chaque pas avec sa propre durée (`stepsMs`, une CONSTANTE de module — une
 * liste recréée à chaque rendu réarmerait le minuteur). Au bout, on repart de
 * zéro dans un nouveau `cycle` : le canevas se remonte, plutôt que de
 * rembobiner chaque ressort à l'envers.
 *
 * `active` à faux gèle l'horloge sur le pas courant (onglet caché, scène hors
 * écran) ; `reduced` la cloue sur le dernier pas : l'image finale, fixe, et
 * comme rien ne change plus, rien ne transitionne.
 */
export function useSceneClock(stepsMs: readonly number[], { active, reduced }: SceneClockOptions): SceneClock {
  const last = Math.max(0, stepsMs.length - 1);
  const [clock, setClock] = useState<SceneClock>({ step: 0, cycle: 0 });

  useEffect(() => {
    if (reduced || !active) return;
    const delay = stepsMs[clock.step] ?? 1000;
    const id = setTimeout(() => {
      setClock((prev) =>
        prev.step >= last ? { step: 0, cycle: prev.cycle + 1 } : { step: prev.step + 1, cycle: prev.cycle },
      );
    }, delay);
    return () => clearTimeout(id);
  }, [active, reduced, clock.step, clock.cycle, stepsMs, last]);

  return reduced ? { step: last, cycle: 0 } : clock;
}
