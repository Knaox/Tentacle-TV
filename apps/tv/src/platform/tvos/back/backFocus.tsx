import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { TVFocusGuideView, type View } from "react-native";
import type { FocusGroupContainerProps } from "../../redesign/focus/focusBinding";
import { isNavKey } from "../nav/useRailState";
import { setFocusLocked } from "./focusLocks";
import type { FocusStore } from "./focusStore";

/**
 * Le focus de la croix Retour d'un écran (`BackButton`, posée par sa vue en
 * haut à gauche), commun à tous les écrans de la refonte — hors lecteur, qui a
 * ses propres guides, et grand panneau (`sheetFocus`).
 *
 * - JAMAIS L'ENTRÉE, sauf seule action. À l'arrivée — et à chaque nouvelle
 *   étape (`arrival`) —, la croix reste infocalisable tant que le focus ne
 *   s'est pas posé ailleurs : tvOS la choisirait, cible la plus en haut à
 *   gauche, avant que l'entrée ne se monte (chargement) ou ne prenne sa
 *   préférence — et le premier focus de contenu clôt l'arrivée
 *   (`useEntryFocus`) : elle l'aurait gardé. Quand elle EST l'entrée (seule
 *   action : chargement d'une page vide, code du relais), rien n'est
 *   verrouillé : c'est l'écran qui la vise.
 * - Toujours ATTEIGNABLE ensuite :
 *   - HAUT depuis n'importe où dessous : sa bande (`barKey`, `FocusGroup`
 *     pleine largeur) reçoit le geste et le rend à la croix — tvOS ne vise
 *     que ce qui CHEVAUCHE (mesuré sur la croix du grand panneau). Armée
 *     seulement une fois la croix libre (avant, une cible sans issue), et
 *     désarmée pendant que la navigation a le focus (sa capsule ouverte passe
 *     au-dessus de la bande) ;
 *   - BAS depuis la croix : `nextFocusDown` vers la dernière cible de contenu
 *     qui a eu le focus, sinon vers l'entrée — rien n'est aligné sous elle à
 *     coup sûr (un panneau centré, un champ, une carte à droite).
 */

export interface BackFocusOptions {
  /** La clé de la croix (`BackButton focusKey`). */
  backKey: string;
  /** Sa bande pleine largeur (`FocusGroup`) — absente quand la croix vit dans
   *  un en-tête qui a déjà son guide (Parcourir). */
  barKey?: string;
  /** L'entrée de l'écran en ce moment ; la croix l'est quand elle est la seule action. */
  entryKey: string | null;
  /** Ce qui fait une nouvelle ARRIVÉE — l'étape d'un automate : la croix s'y reverrouille. */
  arrival?: unknown;
}

/** Le verrou de la croix, partagé avec le guide de sa bande. */
interface BackLock {
  locked: boolean;
  readonly listeners: Set<() => void>;
}

type Settable = { setNativeProps?: (props: object) => void };

export function useBackFocus(focus: FocusStore, { backKey, barKey, entryKey, arrival }: BackFocusOptions): void {
  const [lock] = useState<BackLock>(() => ({ locked: false, listeners: new Set() }));
  const entry = useRef(entryKey);
  entry.current = entryKey;
  const lastContent = useRef<string | null>(null);

  const setLocked = useCallback(
    (locked: boolean, notify = true) => {
      if (lock.locked === locked) return;
      lock.locked = locked;
      setFocusLocked(focus, backKey, locked);
      if (notify) for (const listener of [...lock.listeners]) listener();
    },
    [focus, backKey, lock],
  );

  // L'ARRIVÉE, posée pendant le rendu — avant celui de la croix, qui lit sa
  // liaison en se rendant. La bande se lie au tout premier (le port veut un
  // conteneur stable, lié avant que le groupe ne paraisse). Le guide de la
  // bande est prévenu après le rendu, jamais pendant. Une nouvelle étape
  // démonte ce qui avait le focus : le focus qui suivra lèvera le verrou.
  const arrived = useRef<{ value: unknown } | null>(null);
  if (arrived.current === null || arrived.current.value !== arrival) {
    if (arrived.current === null && barKey) focus.bind(barKey, { container: createBackGuide(focus, backKey, lock) });
    arrived.current = { value: arrival };
    if (entryKey !== backKey) setLocked(true, false);
  }
  useEffect(() => {
    for (const listener of [...lock.listeners]) listener();
  }, [arrival, lock]);

  // Devenue la seule action : libre — l'écran la vise.
  useEffect(() => {
    if (entryKey === backKey) setLocked(false);
  }, [entryKey, backKey, setLocked]);

  useEffect(
    () =>
      focus.subscribe((key, focused) => {
        if (!focused) return;
        if (key === backKey) {
          // BAS depuis la croix : la dernière cible de contenu encore montée, sinon l'entrée.
          const last = lastContent.current;
          const target = last && focus.node(last) ? last : entry.current;
          const handle = target && target !== backKey ? focus.handle(target) : null;
          (focus.node(backKey) as Settable | null)?.setNativeProps?.({ nextFocusDown: handle });
          return;
        }
        if (!isNavKey(key)) lastContent.current = key;
        setLocked(false);
      }),
    [focus, backKey, setLocked],
  );

  useEffect(
    () => () => {
      if (barKey) focus.bind(barKey, null);
    },
    [focus, barKey],
  );
}

const NONE: View[] = [];

/**
 * Le guide de la bande de la croix : HAUT depuis n'importe quelle cible
 * dessous y entre et atterrit sur la croix. Créé une fois par écran (le port
 * l'exige stable) ; il vise de nouveau à chaque focus, à chaque montage de la
 * croix, à chaque levée du verrou et après chacun de ses rendus.
 */
function createBackGuide(store: FocusStore, backKey: string, lock: BackLock): ComponentType<FocusGroupContainerProps> {
  return function BackGuide({ style, pointerEvents, children }: FocusGroupContainerProps) {
    const [target, setTarget] = useState<View[]>(NONE);

    const aim = useCallback(() => {
      const armed = !lock.locked && !isNavKey(store.focusedKey());
      const node = armed ? store.node(backKey) : null;
      setTarget((prev) => (node ? (prev[0] === node ? prev : [node]) : NONE));
    }, []);

    useEffect(() => {
      lock.listeners.add(aim);
      const offFocus = store.subscribe(() => aim());
      const offNodes = store.subscribeNodes((key) => {
        if (key === backKey) aim();
      });
      return () => {
        lock.listeners.delete(aim);
        offFocus();
        offNodes();
      };
    }, [aim]);
    useEffect(aim);

    return (
      <TVFocusGuideView
        style={style}
        pointerEvents={pointerEvents}
        destinations={target}
        focusable={target.length > 0 ? undefined : false}
      >
        {children}
      </TVFocusGuideView>
    );
  };
}
