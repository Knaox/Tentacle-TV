import {
  createElement,
  forwardRef,
  useEffect,
  useRef,
  Children,
  Fragment,
  type ReactNode,
  type ReactElement,
} from "react";
import { trierProprietes } from "./framerMotionProps";

/**
 * framer-motion, en inerte.
 *
 * Substitué au paquet par la configuration de build : quarante-huit fichiers
 * d'`apps/web` en dépendent, dont `GlassCard` et `MediaCard` de
 * `packages/ui` — les modifier reviendrait à forker l'interface partagée. Ici
 * on rend les mêmes éléments, sans les animer : les animations qui comptent
 * sur un téléviseur sont réintroduites en CSS pur dans la feuille TV.
 *
 * **Inerte, mais poli.** Ne rien jouer ne dispense pas de tenir le contrat :
 * `onAnimationComplete` et `onExitComplete` doivent être appelés, sinon un
 * appelant qui attend la fin d'une animation pour changer d'état reste bloqué.
 * `DetailOpenOverlay` est exactement ce cas — son `onExitComplete` remet
 * `playing` à faux, et sans lui un calque plein écran resterait monté sur
 * chaque fiche média ouverte.
 */

type Proprietes = Record<string, unknown>;
type Rappel = () => void;

/** Exécute au tick suivant, jamais pendant le rendu. */
function auTickSuivant(rappel: Rappel): void {
  Promise.resolve().then(rappel);
}

function creerComposant(balise: string) {
  const Composant = forwardRef<unknown, Proprietes>((proprietes, ref) => {
    const { dom, animation } = trierProprietes(proprietes);

    // Le rappel est presque toujours une lambda, donc une référence neuve à
    // chaque rendu : le lire depuis une référence mutable évite d'en faire une
    // dépendance d'effet, et donc de le rejouer indéfiniment.
    const fini = useRef(animation.onAnimationComplete);
    fini.current = animation.onAnimationComplete;
    useEffect(() => {
      // Joué au montage, et là seulement : sans animation réelle, il n'existe
      // aucun autre instant où une animation pourrait « se terminer ».
      if (typeof fini.current === "function") auTickSuivant(fini.current as Rappel);
    }, []);

    return createElement(balise, { ...dom, ref });
  });
  Composant.displayName = `motion.${balise}`;
  return Composant;
}

const cacheComposants = new Map<string, ReturnType<typeof creerComposant>>();

/**
 * `motion.div`, `motion.button`, `motion.h1`… Le proxy fabrique le composant
 * à la première demande et le garde : renvoyer un composant neuf à chaque
 * accès ferait remonter tout le sous-arbre à chaque rendu du parent.
 */
export const motion = new Proxy({} as Record<string, unknown>, {
  get(_cible, propriete: string) {
    let composant = cacheComposants.get(propriete);
    if (!composant) {
      composant = creerComposant(propriete);
      cacheComposants.set(propriete, composant);
    }
    return composant;
  },
});

/**
 * Rend ses enfants sans différer leur démontage, et signale la sortie.
 *
 * `onExitComplete` est appelé au passage « des enfants » → « plus aucun
 * enfant ». C'est la transition que l'appelant observe réellement ; la
 * signaler au tick suivant lui laisse le temps d'avoir été démonté.
 */
export function AnimatePresence(
  proprietes: { children?: ReactNode; onExitComplete?: Rappel },
): ReactElement | null {
  const nombre = Children.count(proprietes.children);
  const precedent = useRef(nombre);

  useEffect(() => {
    if (precedent.current > 0 && nombre === 0 && proprietes.onExitComplete) {
      auTickSuivant(proprietes.onExitComplete);
    }
    precedent.current = nombre;
  }, [nombre, proprietes.onExitComplete]);

  return createElement(Fragment, null, proprietes.children);
}

/**
 * Faux sur un téléviseur : le système n'expose pas de préférence de mouvement
 * réduit, et les branches « sans animation » d'`apps/web` sautent parfois un
 * changement d'état que le shim ne rejouerait pas. Renvoyer faux garde le
 * chemin de code habituel — c'est la feuille TV qui décide de ce qui bouge.
 */
export function useReducedMotion(): boolean {
  return false;
}

/**
 * Résout la courbe de Bézier cubique, par Newton-Raphson puis dichotomie.
 *
 * Ce n'est pas un bouchon : `HeroBackdrop` échantillonne cette courbe pour
 * fabriquer les étapes d'un fondu, et une approximation linéaire y produirait
 * une transition visiblement différente.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const a = (u: number, v: number) => 1 - 3 * v + 3 * u;
  const b = (u: number, v: number) => 3 * v - 6 * u;
  const c = (u: number) => 3 * u;
  const courbe = (t: number, u: number, v: number) =>
    ((a(u, v) * t + b(u, v)) * t + c(u)) * t;
  const pente = (t: number, u: number, v: number) =>
    3 * a(u, v) * t * t + 2 * b(u, v) * t + c(u);

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const ecart = courbe(t, x1, x2) - x;
      if (Math.abs(ecart) < 1e-6) return courbe(t, y1, y2);
      const derivee = pente(t, x1, x2);
      if (Math.abs(derivee) < 1e-6) break;
      t -= ecart / derivee;
    }
    let bas = 0;
    let haut = 1;
    t = x;
    while (haut - bas > 1e-6) {
      if (courbe(t, x1, x2) > x) haut = t;
      else bas = t;
      t = (haut + bas) / 2;
    }
    return courbe(t, y1, y2);
  };
}

/* Les trois exports suivants ne servent qu'à Watch Together, exclu du bundle
 * téléviseur. Ils existent pour que le module reste substituable en entier. */

export interface MotionValue<T = number> {
  get(): T;
  set(valeur: T): void;
}

export function useMotionValue<T>(initiale: T): MotionValue<T> {
  const reference = useRef(initiale);
  return {
    get: () => reference.current,
    set: (valeur: T) => {
      reference.current = valeur;
    },
  };
}

export function useDragControls(): { start(): void } {
  return { start: () => undefined };
}

export function animate(): { stop(): void } {
  return { stop: () => undefined };
}
