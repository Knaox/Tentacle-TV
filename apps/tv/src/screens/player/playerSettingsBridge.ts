import { useSyncExternalStore } from "react";
import type { TVTrackSelectorProps } from "../../components/TVTrackSelector";

/**
 * Pont d'état entre `PlayerScreen` (qui détient les pistes/qualité + handlers) et
 * la route modale `PlayerSettings` (sibling du Player dans le native-stack, donc
 * hors de son contexte React). Le Player publie les props du sélecteur ; la route
 * les lit en live (les pistes chargent en async, la sélection change). Au démontage
 * de la route (ESC natif OU bouton Fermer), `notifyClosed()` resynchronise le Player.
 */
export type SettingsPanelProps = Omit<TVTrackSelectorProps, "disableBackHandler">;

let current: SettingsPanelProps | null = null;
let onClosed: (() => void) | null = null;
const listeners = new Set<() => void>();

export function setSettingsPanelProps(props: SettingsPanelProps | null): void {
  current = props;
  listeners.forEach((l) => l());
}

export function setSettingsOnClosed(cb: (() => void) | null): void {
  onClosed = cb;
}

export function notifySettingsClosed(): void {
  onClosed?.();
}

export function useSettingsPanelProps(): SettingsPanelProps | null {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => current,
    () => current,
  );
}
