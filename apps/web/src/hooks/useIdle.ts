import { useEffect, useState } from "react";

/** Gestes qui comptent comme une présence. `pointermove` couvre souris ET tactile. */
const ACTIVITY = ["pointermove", "pointerdown", "keydown", "wheel", "scroll", "touchstart"] as const;

/**
 * Fenêtre pendant laquelle un même geste ne réarme pas le minuteur. Un
 * déplacement de souris émet des dizaines d'évènements par seconde ; les
 * traiter tous coûterait plus cher que ce que ce hook fait économiser.
 */
const THROTTLE_MS = 500;

/**
 * « Personne n'a rien fait depuis un moment. »
 *
 * Pourquoi ce hook existe : une animation en cours fait produire au navigateur
 * une image à CHAQUE rafraîchissement de l'écran — soixante fois par seconde,
 * cent vingt sur un écran rapide — et cela ne dépend pas de la cadence à
 * laquelle sa valeur change. Brider une animation allège donc le travail par
 * image, mais n'endort jamais le compositeur : tant qu'une seule animation est
 * active, le GPU reste éveillé.
 *
 * Le seul geste qui le fait redescendre est donc l'ARRÊT. Et le seul moment où
 * l'on peut arrêter un ornement sans que personne ne s'en aperçoive, c'est
 * quand personne ne regarde.
 *
 * À réserver aux ornements — une bannière qui zoome, un halo qui dérive. Jamais
 * à ce qui porte une information (progression d'un téléchargement, décompte),
 * ni à ce qui répond à un geste : par définition, un geste sort de l'inactivité.
 *
 * @param delayMs Silence requis avant de basculer en inactif.
 */
export function useIdle(delayMs: number): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let lastSeen = 0;

    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), delayMs);
    };

    const onActivity = () => {
      const now = performance.now();
      if (now - lastSeen < THROTTLE_MS) return;
      lastSeen = now;
      // Sur un état déjà faux, React court-circuite : tant qu'on est actif,
      // ceci ne provoque aucun rendu.
      setIdle(false);
      arm();
    };

    arm();
    for (const type of ACTIVITY) {
      window.addEventListener(type, onActivity, { passive: true });
    }
    return () => {
      clearTimeout(timer);
      for (const type of ACTIVITY) window.removeEventListener(type, onActivity);
    };
  }, [delayMs]);

  return idle;
}
