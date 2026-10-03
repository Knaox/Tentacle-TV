import { useSyncExternalStore } from "react";

/**
 * Les messages brefs du mobile — un geste défait faute de serveur (« Ma
 * liste n'a pas pu être modifiée — Le serveur Tentacle ne répond pas »).
 * Rendus par l'hôte des avertissements, en haut : deux au plus, le même
 * titre jamais deux fois de suite.
 */
export interface AppToast {
  id: number;
  title: string;
  text?: string;
}

const MAX_TOASTS = 2;
let toasts: readonly AppToast[] = [];
let sequence = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function showToast(toast: Omit<AppToast, "id">): void {
  if (toasts.some((entry) => entry.title === toast.title && entry.text === toast.text)) return;
  sequence += 1;
  toasts = [...toasts, { ...toast, id: sequence }].slice(-MAX_TOASTS);
  emit();
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((entry) => entry.id !== id);
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useToasts(): readonly AppToast[] {
  return useSyncExternalStore(subscribe, () => toasts, () => toasts);
}
