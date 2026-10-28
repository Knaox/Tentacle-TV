/**
 * Octave mobile — un hôte UNIQUE (feuilles d'action, avis, choix de playlist) :
 * la coquille le monte une fois, et chaque écran des pages le monte aussi pour
 * marcher même sans elle. Seul le PREMIER monté rend ; quand il part, le
 * suivant prend la main. Jamais deux feuilles l'une sur l'autre.
 */

import { useEffect, useState } from "react";

const order: number[] = [];
const listeners = new Set<() => void>();
let nextId = 0;
const emit = () => listeners.forEach((l) => l());

export function useSingleHost(): boolean {
  const [id] = useState(() => ++nextId);
  const [, bump] = useState(0);
  useEffect(() => {
    order.push(id);
    const listener = () => bump((n) => n + 1);
    listeners.add(listener);
    emit();
    return () => {
      order.splice(order.indexOf(id), 1);
      listeners.delete(listener);
      emit();
    };
  }, [id]);
  return order[0] === id;
}
