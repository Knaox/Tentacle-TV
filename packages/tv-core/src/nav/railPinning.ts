import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Ce que le rail n'affiche pas.
 *
 * **Une liste d'exclusion, pas une liste d'épinglage.** Le client web a bien
 * `usePinnedNav`, mais sa sémantique est inverse : le défaut y est vide et
 * signifie « rien dans la barre », ce qui convient à une barre horizontale où
 * la place manque. Sur un téléviseur, hériter de ce défaut livrait un serveur
 * de huit bibliothèques derrière trois entrées dont aucune n'y menait.
 *
 * En inversant, le défaut vide signifie « tout est là » : on découvre son
 * serveur entier au premier allumage, puis on retire ce dont on ne veut pas. Le
 * rail ne peut jamais devenir vide par accident, et il n'y a rien à configurer
 * pour qu'il serve.
 *
 * Le stockage est local à l'appareil, volontairement : le salon et la chambre
 * ne regardent pas les mêmes choses.
 *
 * Module pur : le stockage est injecté. `localStorage` le satisfait tel quel
 * côté LG ; `RNStorageAdapter` aussi côté natif, qui est synchrone une fois
 * hydraté — c'est ce qui permet à `useSyncExternalStore` de fonctionner des
 * deux côtés sans traitement particulier.
 */

export const RAIL_STORAGE_KEY = "tentacle_webos_rail";

/** Le minimum qu'un stockage doit offrir. `localStorage` et `RNStorageAdapter`
 *  le satisfont l'un comme l'autre. */
export interface RailStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * L'état PERSISTÉ, tel qu'il est sérialisé sous `RAIL_STORAGE_KEY`.
 *
 * `masquees` garde son nom français : c'est une clé du JSON stocké, pas un
 * simple identifiant. La renommer ferait écrire `hidden` et relire `hidden`,
 * donc perdre en silence les entrées que l'utilisateur avait masquées.
 */
interface RailState {
  masquees: string[];
}

const EMPTY: RailState = { masquees: [] };

export interface RailPinning {
  masquees: string[];
  isHidden: (key: string) => boolean;
  toggle: (key: string) => void;
  showAll: () => void;
}

export interface RailPinningStore {
  subscribe: (callback: () => void) => () => void;
  readSnapshot: () => RailState;
  toggle: (key: string) => void;
  showAll: () => void;
  isHidden: (key: string) => boolean;
  /**
   * Relit le stockage et notifie si l'état a changé. Nécessaire quand le
   * stockage s'hydrate APRÈS la création du magasin (RNStorageAdapter sur
   * Android TV : `getItem` ne lit qu'un cache mémoire rempli par un
   * `hydrate()` asynchrone — sans cette relecture, les entrées masquées
   * réapparaissent à chaque redémarrage).
   */
  rehydrate: () => void;
}

/**
 * Crée le magasin. Un seul par application : l'instantané est partagé pour que
 * toutes les instances du hook restent d'accord sans passer par un contexte.
 */
export function createRailPinningStore(
  storage: RailStorage,
  key: string = RAIL_STORAGE_KEY,
): RailPinningStore {
  const listeners = new Set<() => void>();

  const readStorage = (): RailState => {
    try {
      const raw = storage.getItem(key);
      if (!raw) return EMPTY;
      const loaded = JSON.parse(raw) as Partial<RailState>;
      return { masquees: Array.isArray(loaded.masquees) ? loaded.masquees : [] };
    } catch {
      // Stockage illisible ou JSON corrompu : le rail montre tout, ce qui est
      // le pire cas acceptable. Un rail vide, lui, ne le serait pas.
      return EMPTY;
    }
  };

  let snapshot: RailState = readStorage();

  const write = (next: RailState): void => {
    snapshot = next;
    try {
      storage.setItem(key, JSON.stringify(next));
    } catch {
      // Stockage indisponible : le rail vaut pour cette session, et c'est tout.
    }
    listeners.forEach((listener) => listener());
  };

  return {
    subscribe(callback) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    readSnapshot: () => snapshot,
    toggle(entryKey) {
      const masquees = snapshot.masquees.includes(entryKey)
        ? snapshot.masquees.filter((other) => other !== entryKey)
        : snapshot.masquees.concat(entryKey);
      write({ masquees });
    },
    showAll() {
      if (snapshot.masquees.length === 0) return;
      write({ masquees: [] });
    },
    isHidden: (entryKey) => snapshot.masquees.includes(entryKey),
    rehydrate() {
      const loaded = readStorage();
      const same =
        loaded.masquees.length === snapshot.masquees.length &&
        loaded.masquees.every((key, i) => key === snapshot.masquees[i]);
      if (same) return;
      snapshot = loaded;
      listeners.forEach((listener) => listener());
    },
  };
}

/** Le hook, lié à un magasin. Chaque cible en fabrique un au démarrage. */
export function createUseRailPinning(store: RailPinningStore) {
  return function useRailPinning(): RailPinning {
    const state = useSyncExternalStore(store.subscribe, store.readSnapshot);

    const toggle = useCallback((key: string) => store.toggle(key), []);
    const showAll = useCallback(() => store.showAll(), []);
    const isHidden = useCallback(
      (key: string) => state.masquees.includes(key),
      [state.masquees],
    );

    return useMemo(
      () => ({ masquees: state.masquees, isHidden, toggle, showAll }),
      [state.masquees, isHidden, toggle, showAll],
    );
  };
}
