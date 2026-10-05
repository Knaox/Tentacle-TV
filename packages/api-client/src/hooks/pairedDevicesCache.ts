import type { QueryClient } from "@tanstack/react-query";

/** Les deux listes d'appareils jumelés : celle du compte, et celle de l'admin. */
export const MY_PAIRED_DEVICES_KEY = ["my-paired-devices"] as const;
export const PAIRED_DEVICES_KEY = ["paired-devices"] as const;

/** La liste sans l'appareil `id` ; la même liste (même référence) s'il n'y était pas. */
export function withoutPairedDevice<T extends { id: string }>(list: readonly T[] | undefined, id: string): T[] | undefined {
  if (!list || !list.some((device) => device.id === id)) return list as T[] | undefined;
  return list.filter((device) => device.id !== id);
}

/** Un refus du serveur qui dit que l'appareil n'existe déjà plus (révoqué ailleurs). */
export function isAlreadyRevoked(error: unknown): boolean {
  return (error as { status?: unknown } | null)?.status === 404;
}

/**
 * Un déjumelage vient d'aboutir (ou l'appareil n'existait déjà plus) : la
 * ligne quitte AUSSITÔT les deux listes, sans attendre la relecture — qui
 * part quand même, pour reprendre la vérité du serveur.
 */
export function forgetPairedDevice(qc: QueryClient, id: string): void {
  for (const key of [MY_PAIRED_DEVICES_KEY, PAIRED_DEVICES_KEY]) {
    qc.setQueryData<{ id: string }[]>(key, (list) => withoutPairedDevice(list, id));
  }
}

/** Les deux listes relues : une ligne d'appareil vient de naître ou de mourir. */
export function refreshPairedDevices(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: MY_PAIRED_DEVICES_KEY });
  void qc.invalidateQueries({ queryKey: PAIRED_DEVICES_KEY });
}
