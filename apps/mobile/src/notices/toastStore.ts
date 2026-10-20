import { useSyncExternalStore } from "react";

/**
 * Le ton d'un message bref : `failure` (le défaut — un geste défait, triangle
 * rouge), `success` (une réussite — coche verte : « Vous avez rejoint la
 * famille », « Code PIN enregistré »), `info` (un simple constat, violet).
 */
export type ToastTone = "failure" | "success" | "info";

/**
 * Les messages brefs du mobile — un geste défait faute de serveur (« Ma
 * liste n'a pas pu être modifiée — Le serveur Tentacle ne répond pas »), ou
 * une réussite dite au ton `success`.
 * Rendus par l'hôte des avertissements, en haut : deux au plus, le même
 * titre jamais deux fois de suite.
 */
export interface AppToast {
  id: number;
  title: string;
  text?: string;
  /** Absent : `failure` — les appels d'avant le ton restaient des échecs. */
  tone?: ToastTone;
  /** Imposer couleur et pictogramme (un message du modèle d'erreurs : `problemBanner.ts`). */
  appearance?: ToastAppearance;
  /** Un geste, au plus deux (« Ouvrir les réglages », « Rejoindre de nouveau »). */
  primary?: ToastAction;
  secondary?: ToastAction;
}

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastAppearance {
  severity: "blocking" | "recommendation" | "success" | "info";
  icon: "alert-triangle" | "check" | "info" | "server" | "wifi-off" | "activity" | "key";
}

/** Ce que rend la carte pour chaque ton : sa couleur et son pictogramme. */
export function toastAppearance(tone: ToastTone | undefined): ToastAppearance {
  if (tone === "success") return { severity: "success", icon: "check" };
  if (tone === "info") return { severity: "info", icon: "info" };
  return { severity: "blocking", icon: "alert-triangle" };
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
