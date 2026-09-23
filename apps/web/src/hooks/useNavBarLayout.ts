import { useMemo, useSyncExternalStore } from "react";
import { EMPTY_LAYOUT, parseLayout, withHidden, type NavLayout } from "../components/nav/navLayout";

/**
 * Le magasin de la disposition de la barre desktop (`navLayout.ts`) :
 * `localStorage`, un instantané partagé par toutes les instances du hook, et
 * les autres onglets suivis par l'évènement `storage` — personnaliser la barre
 * dans une fenêtre la change dans l'autre.
 *
 * ⚠️ `tentacle_nav_bar` et les champs `order` / `hidden` sont des clés de
 * stockage : les renommer perdrait en silence la barre de chacun.
 */

const STORAGE_KEY = "tentacle_nav_bar";

function read(): NavLayout {
  try {
    return parseLayout(localStorage.getItem(STORAGE_KEY));
  } catch {
    return EMPTY_LAYOUT;
  }
}

let snapshot: NavLayout = read();
const listeners = new Set<() => void>();

function emit(next: NavLayout): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

function write(next: NavLayout): void {
  try {
    if (next.order.length === 0 && next.hidden.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Stockage plein ou refusé : la barre suit quand même pour la session.
  }
  emit(next);
}

function onStorage(event: StorageEvent): void {
  if (event.key === STORAGE_KEY) emit(read());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function useNavBarLayout() {
  const layout = useSyncExternalStore(subscribe, () => snapshot);
  return useMemo(() => ({
    layout,
    setOrder: (order: string[]) => write({ ...snapshot, order }),
    setHidden: (key: string, hide: boolean) => write({ ...snapshot, hidden: withHidden(snapshot.hidden, key, hide) }),
    reset: () => write(EMPTY_LAYOUT),
  }), [layout]);
}
