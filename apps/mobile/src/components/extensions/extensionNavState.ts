import { useSyncExternalStore } from "react";

/**
 * Où en est l'utilisateur dans les extensions : le plugin affiché, et la
 * dernière page vue de CHAQUE plugin. Partagé entre l'écran des extensions (qui
 * l'écrit) et la barre de navigation (le sous-menu coche le plugin courant,
 * l'onglet prend son nom) — deux arbres que rien d'autre ne relie.
 *
 * Revenir à un plugin par le sous-menu rouvre la page où on l'avait laissé,
 * pas sa première page : on navigue ENTRE les plugins, on ne recommence pas.
 */

let activePluginId: string | null = null;
const lastSection = new Map<string, string>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** L'écran des extensions affiche cette section. */
export function noteExtensionSection(pluginId: string, sectionId: string): void {
  lastSection.set(pluginId, sectionId);
  if (activePluginId === pluginId) return;
  activePluginId = pluginId;
  emit();
}

/** La page où rouvrir un plugin : la dernière vue, sinon celle proposée. */
export function resumeSectionFor(pluginId: string, fallback: string): string {
  return lastSection.get(pluginId) ?? fallback;
}

export function useActiveExtensionPlugin(): string | null {
  return useSyncExternalStore(subscribe, () => activePluginId);
}
