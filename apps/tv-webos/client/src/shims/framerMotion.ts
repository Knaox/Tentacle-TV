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
import { sortProps } from "./framerMotionProps";

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

type Props = Record<string, unknown>;
type Rappel = () => void;

/** Exécute au tick suivant, jamais pendant le rendu. */
function onNextTick(rappel: Rappel): void {
  Promise.resolve().then(rappel);
}

function createComponent(tag: string) {
  const Component = forwardRef<unknown, Props>((props, ref) => {
    const { dom, animation } = sortProps(props);

    // Le rappel est presque toujours une lambda, donc une référence neuve à
    // chaque rendu : le lire depuis une référence mutable évite d'en faire une
    // dépendance d'effet, et donc de le rejouer indéfiniment.
    const done = useRef(animation.onAnimationComplete);
    done.current = animation.onAnimationComplete;
    useEffect(() => {
      // Joué au montage, et là seulement : sans animation réelle, il n'existe
      // aucun autre instant où une animation pourrait « se terminer ».
      if (typeof done.current === "function") onNextTick(done.current as Rappel);
    }, []);

    return createElement(tag, { ...dom, ref });
  });
  Component.displayName = `motion.${tag}`;
  return Component;
}

const componentCache = new Map<string, ReturnType<typeof createComponent>>();

/**
 * `motion.div`, `motion.button`, `motion.h1`… Le proxy fabrique le composant
 * à la première demande et le garde : renvoyer un composant neuf à chaque
 * accès ferait remonter tout le sous-arbre à chaque rendu du parent.
 */
export const motion = new Proxy({} as Record<string, unknown>, {
  get(_target, property: string) {
    let component = componentCache.get(property);
    if (!component) {
      component = createComponent(property);
      componentCache.set(property, component);
    }
    return component;
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
  props: { children?: ReactNode; onExitComplete?: Rappel },
): ReactElement | null {
  const count = Children.count(props.children);
  const precedent = useRef(count);

  useEffect(() => {
    if (precedent.current > 0 && count === 0 && props.onExitComplete) {
      onNextTick(props.onExitComplete);
    }
    precedent.current = count;
  }, [count, props.onExitComplete]);

  return createElement(Fragment, null, props.children);
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
  const curve = (t: number, u: number, v: number) =>
    ((a(u, v) * t + b(u, v)) * t + c(u)) * t;
  const slope = (t: number, u: number, v: number) =>
    3 * a(u, v) * t * t + 2 * b(u, v) * t + c(u);

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const gap = curve(t, x1, x2) - x;
      if (Math.abs(gap) < 1e-6) return curve(t, y1, y2);
      const derived = slope(t, x1, x2);
      if (Math.abs(derived) < 1e-6) break;
      t -= gap / derived;
    }
    let bottom = 0;
    let top = 1;
    t = x;
    while (top - bottom > 1e-6) {
      if (curve(t, x1, x2) > x) top = t;
      else bottom = t;
      t = (top + bottom) / 2;
    }
    return curve(t, y1, y2);
  };
}

/* Les trois exports suivants ne servent qu'à Watch Together, exclu du bundle
 * téléviseur. Ils existent pour que le module reste substituable en entier. */

export interface MotionValue<T = number> {
  get(): T;
  set(value: T): void;
}

export function useMotionValue<T>(initial: T): MotionValue<T> {
  const reference = useRef(initial);
  return {
    get: () => reference.current,
    set: (value: T) => {
      reference.current = value;
    },
  };
}

export function useDragControls(): { start(): void } {
  return { start: () => undefined };
}

export function animate(): { stop(): void } {
  return { stop: () => undefined };
}
