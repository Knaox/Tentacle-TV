/**
 * Octave mobile — un hôte UNIQUE (feuilles d'action, avis, choix de playlist) :
 * la coquille le monte une fois au-dessus de tout (`primary`), et chaque écran
 * des pages le monte aussi pour marcher même sans elle. Seul UN rend : celui de
 * la coquille s'il est là, sinon le premier monté ; quand il part, le suivant
 * prend la main. Jamais deux feuilles l'une sur l'autre.
 */

import { useEffect, useState } from "react";

interface Entry {
  id: number;
  primary: boolean;
}

const entries: Entry[] = [];
const listeners = new Set<() => void>();
let nextId = 0;
const emit = () => listeners.forEach((l) => l());

/** L'hôte qui rend : le premier « primaire », sinon le premier monté. Exporté pour les tests. */
export function activeHost(list: readonly Entry[]): number | null {
  return (list.find((e) => e.primary) ?? list[0])?.id ?? null;
}

export function useSingleHost(primary = false): boolean {
  const [id] = useState(() => ++nextId);
  const [, bump] = useState(0);
  useEffect(() => {
    entries.push({ id, primary });
    const listener = () => bump((n) => n + 1);
    listeners.add(listener);
    emit();
    return () => {
      const at = entries.findIndex((e) => e.id === id);
      if (at >= 0) entries.splice(at, 1);
      listeners.delete(listener);
      emit();
    };
  }, [id, primary]);
  return activeHost(entries) === id;
}
