import { useCallback, useEffect, useMemo, useRef, useState, type Component } from "react";
import { findNodeHandle } from "react-native";
import { osdPlayPauseNodeRef, setOsdFocusReturn, skipClaimedSince, useSkipNode } from "./osdFocusBus";

/** Avance tolérée d'une réclamation du bouton de saut sur le signal de
 *  l'habillage : à la sortie d'une avance rapide, les deux partent du même
 *  geste, à un rendu d'écart, dans un ordre qui n'est pas garanti. */
const SKIP_CLAIM_LEAD_MS = 200;

/** Boutons de transport de l'OSD du lecteur, dans l'ordre de la rangée. */
export type TransportKey =
  | "back" | "prev" | "skipback" | "playpause"
  | "skipforward" | "scrub" | "next" | "episodes" | "settings";

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
  /** Incrément : redonne le focus (réapparition de l'habillage, fermeture d'un
   *  panneau, entrée dans la vidéo). */
  focusSignal: number;
  /**
   * Le bouton VISÉ par le signal courant, s'il est connu.
   *
   * Lu au moment du signal, jamais avant : c'est un ref parce que la cible est
   * décidée par celui qui déclenche (« rends le focus aux épisodes »), pas par
   * un rendu. Absent → le dernier bouton utilisé, comme auparavant.
   */
  focusTargetRef?: { readonly current: TransportKey | undefined };
  /** En scrub (OSD masqué, fond focusable) : verrou de navigation en filet et
   *  gel de la mémoire de focus. */
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
  "prev", "skipback", "playpause", "skipforward", "scrub", "next", "episodes", "settings",
];

export function useOverlayFocusCore({ focusSignal, scrubbing, restore, focusTargetRef }: CoreArgs): OverlayFocusControl {
  const btnRefs = useRef<Partial<Record<TransportKey, FocusNode>>>({});
  // Node handles natifs par bouton — alimentent nextFocusLeft/Right (Android :
  // moteur de proximité ; tvOS : ignorés mais inoffensifs). Une map + un compteur
  // de version (state) pour re-render quand un bouton conditionnel (prev/next/
  // episodes) apparaît/disparaît → recâblage des voisins.
  const handlesRef = useRef<Partial<Record<TransportKey, number>>>({});
  const [handlesVersion, setHandlesVersion] = useState(0);
  const bumpScheduledRef = useRef(false);
  // Signature du dernier ENSEMBLE de boutons présents pour lequel on a re-rendu.
  // tvOS détache/rattache le ref d'un Pressable quand ses props nextFocus*
  // changent → à chaque render tous les boutons font null→node, ce qui appelait
  // bumpHandles → setHandlesVersion → re-render → BOUCLE INFINIE (gel du thread JS).
  // Le microtask s'exécute APRÈS le commit (refs re-stabilisés) : si la signature
  // est inchangée (détach/rattach transitoire du même bouton), on NE re-render PAS.
  // On ne bump donc que quand un bouton conditionnel apparaît/disparaît réellement.
  const lastSigRef = useRef("");
  const bumpHandles = useCallback(() => {
    if (bumpScheduledRef.current) return;
    bumpScheduledRef.current = true;
    queueMicrotask(() => {
      bumpScheduledRef.current = false;
      const sig = Object.keys(handlesRef.current).sort().join(",");
      if (sig === lastSigRef.current) return;
      lastSigRef.current = sig;
      setHandlesVersion((v) => v + 1);
    });
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
        // Publie le node play/pause sur le bus (cible du guide de sortie du skip).
        if (key === "playpause") osdPlayPauseNodeRef.current = (node ?? null) as Component | null;
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

  // Restauration à chaque signal : la cible demandée, sinon le dernier bouton
  // utilisé, sinon play/pause.
  //
  // Le délai est passé de 100 à 220 ms, et ce n'est pas du confort : le signal
  // part À LA FERMETURE d'un panneau, avant que ses vues soient démontées. Tant
  // qu'elles le sont, le moteur de focus tient encore un élément à l'intérieur
  // et refuse la préférence qu'on vient de poser — la restauration tombait dans
  // le vide, et le guide de l'habillage reprenait alors son PREMIER enfant,
  // c'est-à-dire « quitter la vidéo ».
  //
  // Une restauration IMPLICITE cède au bouton de saut qui vient de réclamer le
  // focus (cf. `noteSkipFocusClaim`) : il apparaît, il le prend. Celle qui
  // SUIT son départ ne cède jamais — il n'y a plus personne à qui céder.
  const restoreTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scheduleRestore = useCallback((wanted: TransportKey | undefined, yieldToSkip: boolean) => {
    restoreTimers.current.forEach(clearTimeout);
    restoringFocusRef.current = true;
    const askedAt = Date.now();
    restoreTimers.current = [
      setTimeout(() => {
        if (yieldToSkip && skipClaimedSince(askedAt - SKIP_CLAIM_LEAD_MS)) return;
        const target = (wanted ? btnRefs.current[wanted] : undefined)
          ?? btnRefs.current[lastFocusedRef.current]
          ?? btnRefs.current.playpause
          ?? null;
        if (wanted) lastFocusedRef.current = wanted;
        restore(target);
      }, 220),
      setTimeout(() => { restoringFocusRef.current = false; }, 520),
    ];
  }, [restore]);
  useEffect(() => {
    const timers = restoreTimers;
    return () => timers.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!focusSignal) return;
    const wanted = focusTargetRef?.current;
    scheduleRestore(wanted, !wanted);
  }, [focusSignal, scheduleRestore, focusTargetRef]);

  // Le bouton de saut qui tenait le focus s'en va : retour au dernier bouton
  // utilisé (play/pause par défaut), par le même chemin que le signal.
  useEffect(() => setOsdFocusReturn(() => scheduleRestore(undefined, false)), [scheduleRestore]);

  // NB : pendant un scrub, l'OSD est MASQUÉ (boutons non focusables, le fond
  // reprend le focus) — le verrou de navigation ci-dessous n'est qu'un filet si
  // un focus transitoire subsiste sur un bouton ; la validation OK pendant le
  // scrub est gérée globalement (useTVPlayerControls).

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

  // Le bouton de saut à l'écran : c'est LUI que ↑ atteint depuis la rangée —
  // Android suit `nextFocusUp` avant toute géométrie, et il visait « quitter »,
  // si bien que le bouton, juste au-dessus, restait hors d'atteinte. tvOS
  // l'ignore : le guide de la barre de progression y mène (TVPlayerOverlay).
  const skipNode = useSkipNode();
  const skipHandle = useMemo(
    () => (skipNode ? findNodeHandle(skipNode as never) ?? undefined : undefined),
    [skipNode],
  );

  const buttonProps = useCallback((key: TransportKey): OverlayButtonProps => {
    // Mémoire gelée pendant la restauration ET pendant un scrub (un focus
    // transitoire sur un bouton masqué ne doit pas écraser le dernier utilisé).
    const onFocus = () => {
      if (!restoringFocusRef.current && !scrubbing) lastFocusedRef.current = key;
    };
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
      nextFocusUp: skipHandle ?? backNode, nextFocusLeft: left, nextFocusRight: right,
    };
    // handlesVersion : recompute quand les handles/conditionnels changent.
  }, [scrubbing, initialPreferred, neighbors, handlesVersion, skipHandle]);

  return { registerButton, buttonProps };
}
