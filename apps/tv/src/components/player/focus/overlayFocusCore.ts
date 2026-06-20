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
/** Rangée transport HORIZONTALE (sans `back`, qui est sur la rangée du haut). */
const TRANSPORT_ROW: TransportKey[] = [
  "prev", "skipback", "playpause", "skipforward", "next", "episodes", "settings",
];

export function useOverlayFocusCore({ focusSignal, scrubbing, restore }: CoreArgs): OverlayFocusControl {
  const btnRefs = useRef<Partial<Record<TransportKey, FocusNode>>>({});
  // Node handles natifs par bouton — alimentent nextFocusLeft/Right (Android :
  // moteur de proximité ; tvOS : ignorés mais inoffensifs). Une map + un compteur
  // de version (state) pour re-render quand un bouton conditionnel (prev/next/
  // episodes) apparaît/disparaît → recâblage des voisins.
  const handlesRef = useRef<Partial<Record<TransportKey, number>>>({});
  const [handlesVersion, setHandlesVersion] = useState(0);
  const bumpScheduledRef = useRef(false);
  const bumpHandles = useCallback(() => {
    if (bumpScheduledRef.current) return;
    bumpScheduledRef.current = true;
    queueMicrotask(() => { bumpScheduledRef.current = false; setHandlesVersion((v) => v + 1); });
  }, []);

  const lastFocusedRef = useRef<TransportKey>("playpause");
  // Pendant la restauration, le moteur pose un focus transitoire sur le 1er
  // bouton : on gèle la mémorisation pour ne pas écraser le dernier réellement
  // utilisé.
  const restoringFocusRef = useRef(false);
  // `hasTVPreferredFocus` ne doit valoir true qu'au MONTAGE (focus de départ sur
  // play/pause). Le laisser true en permanence le fait se rebattre contre la
  // mémoire du dernier bouton (autoFocus + restore) → focus qui « saute » sur
  // tvOS. On le repasse false juste après le 1er rendu.
  const [initialPreferred, setInitialPreferred] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setInitialPreferred(false), 0);
    return () => clearTimeout(t);
  }, []);

  // Callbacks de ref STABLES par bouton : si `registerButton(key)` renvoyait une
  // nouvelle fonction à chaque render, React détacherait/rattacherait le ref à
  // CHAQUE rendu (appel avec null puis le node) → la branche null supprimerait le
  // handle + bumpHandles → re-render → boucle infinie (freeze de l'OSD). Mémoïsés,
  // ils ne sont rappelés qu'au vrai montage (node) / démontage (null).
  const refCbCache = useRef<Partial<Record<TransportKey, (node: unknown) => void>>>({});
  const registerButton = useCallback((key: TransportKey) => {
    let cb = refCbCache.current[key];
    if (!cb) {
      cb = (node: unknown) => {
        btnRefs.current[key] = node as FocusNode;
        if (node) {
          const h = findNodeHandle(node as never);
          if (h && handlesRef.current[key] !== h) { handlesRef.current[key] = h; bumpHandles(); }
        } else if (handlesRef.current[key] !== undefined) {
          delete handlesRef.current[key]; bumpHandles();
        }
      };
      refCbCache.current[key] = cb;
    }
    return cb;
  }, [bumpHandles]);

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

  // Voisins gauche/droite parmi les boutons RÉELLEMENT rendus (handle présent) :
  // saute automatiquement les conditionnels absents (prev/next/episodes).
  const neighbors = useCallback((key: TransportKey): { left?: number; right?: number } => {
    const present = TRANSPORT_ROW.filter((k) => handlesRef.current[k] !== undefined);
    const idx = present.indexOf(key);
    if (idx === -1) return {};
    return {
      left: idx > 0 ? handlesRef.current[present[idx - 1]] : undefined,
      right: idx < present.length - 1 ? handlesRef.current[present[idx + 1]] : undefined,
    };
  }, []);

  const buttonProps = useCallback((key: TransportKey): OverlayButtonProps => {
    const onFocus = () => { if (!restoringFocusRef.current) lastFocusedRef.current = key; };
    const playPauseNode = handlesRef.current.playpause;
    const backNode = handlesRef.current.back;
    const preferred = key === "playpause" ? initialPreferred : undefined;

    if (scrubbing) {
      // Verrou complet sur play/pause : ←/→/↑/↓ ne déplacent pas le focus, OK
      // confirme le scrub. (back reste accessible vers le bas.)
      if (key === "back") return { onFocus, nextFocusDown: playPauseNode };
      return {
        onFocus, hasTVPreferredFocus: preferred,
        nextFocusUp: playPauseNode, nextFocusDown: playPauseNode,
        nextFocusLeft: playPauseNode, nextFocusRight: playPauseNode,
      };
    }

    if (key === "back") return { onFocus, nextFocusDown: playPauseNode };
    // Chaînage horizontal explicite entre boutons adjacents rendus.
    const { left, right } = neighbors(key);
    return {
      onFocus, hasTVPreferredFocus: preferred,
      nextFocusUp: backNode, nextFocusLeft: left, nextFocusRight: right,
    };
    // handlesVersion : recompute quand les handles/conditionnels changent.
  }, [scrubbing, initialPreferred, neighbors, handlesVersion]);

  return { registerButton, buttonProps };
}
