import { useCallback, useEffect, useRef, useState } from "react";
import { findNodeHandle } from "react-native";

/** Boutons de transport de l'OSD du lecteur, dans l'ordre de la rangée. */
export type TransportKey =
  | "back" | "prev" | "skipback" | "playpause"
  | "skipforward" | "next" | "episodes" | "settings";

export type FocusNode = { setNativeProps?: (p: Record<string, unknown>) => void } | null;

export interface OverlayButtonProps {
  onFocus: () => void;
  hasTVPreferredFocus?: boolean;
  nextFocusUp?: number;
  nextFocusDown?: number;
  nextFocusLeft?: number;
  nextFocusRight?: number;
}

export interface OverlayFocusControl {
  /** ref callback à poser sur chaque Focusable de l'OSD */
  registerButton: (key: TransportKey) => (node: unknown) => void;
  /** props de focus à étaler sur chaque Focusable */
  buttonProps: (key: TransportKey) => OverlayButtonProps;
}

interface CoreArgs {
  /** Incrément : redonne le focus au dernier bouton utilisé (réapparition OSD). */
  focusSignal: number;
  /** En scrub, le focus est verrouillé sur play/pause. */
  scrubbing: boolean;
  /** Primitive de restauration du focus natif — SEUL point spécifique à la
   *  plateforme (Android = setNativeProps direct ; tvOS = cycle false→true). */
  restore: (node: FocusNode) => void;
}

/**
 * Bookkeeping PARTAGÉ de la mémoire de focus de l'OSD (source unique) : mémorise
 * le dernier bouton focalisé et le restaure au `focusSignal`. La seule
 * différence Android/tvOS est injectée via `restore` (cf. useOverlayFocus[.ios]).
 *
 * Les `nextFocus*` (node handles) ne servent que sur Android (moteur de focus de
 * proximité) ; ignorés sur tvOS, donc inoffensifs — on les expose toujours.
 */
export function useOverlayFocusCore({ focusSignal, scrubbing, restore }: CoreArgs): OverlayFocusControl {
  const btnRefs = useRef<Partial<Record<TransportKey, FocusNode>>>({});
  const lastFocusedRef = useRef<TransportKey>("playpause");
  // Pendant la restauration, le moteur pose un focus transitoire sur le 1er
  // bouton : on gèle la mémorisation pour ne pas écraser le dernier réellement
  // utilisé.
  const restoringFocusRef = useRef(false);
  const [playPauseNode, setPlayPauseNode] = useState<number | undefined>();
  const [backNode, setBackNode] = useState<number | undefined>();
  // `hasTVPreferredFocus` ne doit valoir true qu'au MONTAGE (focus de départ sur
  // play/pause). Le laisser true en permanence le fait se rebattre contre la
  // mémoire du dernier bouton (autoFocus + restore) → focus qui « saute » sur
  // tvOS. On le repasse false juste après le 1er rendu.
  const [initialPreferred, setInitialPreferred] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setInitialPreferred(false), 0);
    return () => clearTimeout(t);
  }, []);

  const registerButton = useCallback((key: TransportKey) => (node: unknown) => {
    btnRefs.current[key] = node as FocusNode;
    if (key === "playpause" && node) {
      const h = findNodeHandle(node as never); if (h) setPlayPauseNode(h);
    }
    if (key === "back" && node) {
      const h = findNodeHandle(node as never); if (h) setBackNode(h);
    }
  }, []);

  // Restauration du dernier bouton utilisé à chaque signal.
  useEffect(() => {
    if (!focusSignal) return;
    restoringFocusRef.current = true;
    const target = btnRefs.current[lastFocusedRef.current] ?? btnRefs.current.playpause ?? null;
    const t1 = setTimeout(() => restore(target), 100);
    const t2 = setTimeout(() => { restoringFocusRef.current = false; }, 350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [focusSignal, restore]);

  // Scrub : verrou du focus natif sur play/pause (sinon ←/→ déplacent le focus
  // entre boutons pendant l'avance, et OK presserait un bouton arbitraire).
  useEffect(() => {
    if (!scrubbing) return;
    const timer = setTimeout(() => restore(btnRefs.current.playpause ?? null), 50);
    return () => clearTimeout(timer);
  }, [scrubbing, restore]);

  const lockFocus = scrubbing ? playPauseNode : undefined;

  const buttonProps = useCallback((key: TransportKey): OverlayButtonProps => {
    const onFocus = () => { if (!restoringFocusRef.current) lastFocusedRef.current = key; };
    if (key === "back") return { onFocus, nextFocusDown: playPauseNode };
    if (key === "playpause") return {
      onFocus,
      // Focus de départ uniquement (cf. initialPreferred) → pas de concurrence
      // permanente avec la mémoire du dernier bouton.
      hasTVPreferredFocus: initialPreferred,
      nextFocusUp: scrubbing ? lockFocus : backNode,
      nextFocusDown: lockFocus, nextFocusLeft: lockFocus, nextFocusRight: lockFocus,
    };
    return { onFocus, nextFocusUp: backNode };
  }, [playPauseNode, backNode, scrubbing, lockFocus, initialPreferred]);

  return { registerButton, buttonProps };
}
