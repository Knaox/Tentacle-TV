import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  recoFilterKey,
  useRecoSettings,
  useSaveRecoProviderFilter,
  useUserId,
} from "@tentacle-tv/api-client";
import {
  bindRecoFilterOwner,
  getRecoFilter,
  isRecoFilterDirty,
  markRecoFilterSynced,
  setRecoFilter,
  subscribeRecoFilter,
} from "../lib/recoFilterStore";

const EMPTY: number[] = [];
const SAVE_DEBOUNCE_MS = 400;

/**
 * Le filtre de plateformes de la page Recommandations : lu de façon
 * SYNCHRONE depuis le miroir local au premier rendu (la bonne page se
 * demande tout de suite), partagé par tous les consommateurs (menu, page,
 * héros, préchargement).
 */
export function useRecoFilter() {
  const userId = useUserId();
  const selected = useSyncExternalStore(
    subscribeRecoFilter,
    () => {
      // Lier le compte à la lecture : idempotent, et la valeur est juste dès
      // le premier rendu (un changement de compte relit le miroir du sien).
      bindRecoFilterOwner(userId);
      return getRecoFilter();
    },
    () => EMPTY
  );
  const setSelected = useCallback((ids: readonly number[]) => setRecoFilter(ids, "user"), []);
  const clear = useCallback(() => setRecoFilter([], "user"), []);
  return { selected, filterKey: recoFilterKey(selected), setSelected, clear };
}

/**
 * Monté UNE fois, par la page : adopte le réglage serveur quand aucune
 * modification locale n'est en attente (multi-appareils), et pousse les
 * modifications locales, débouncées, avec un dernier envoi au démontage.
 */
export function useRecoFilterServerSync(): void {
  const { data: settings } = useRecoSettings();
  const save = useSaveRecoProviderFilter();
  const selected = useSyncExternalStore(subscribeRecoFilter, getRecoFilter, () => EMPTY);
  const saveRef = useRef(save);
  saveRef.current = save;
  const pendingRef = useRef<number[] | null>(null);

  useEffect(() => {
    if (settings) setRecoFilter(settings.providerFilter, "server");
  }, [settings]);

  useEffect(() => {
    if (!isRecoFilterDirty()) return;
    const ids = selected;
    pendingRef.current = ids;
    const timer = setTimeout(() => {
      pendingRef.current = null;
      saveRef.current.mutate(ids, { onSuccess: () => markRecoFilterSynced(ids) });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [selected]);

  // Démontage avec un envoi encore différé : il part maintenant.
  useEffect(
    () => () => {
      const ids = pendingRef.current;
      if (ids) {
        pendingRef.current = null;
        saveRef.current.mutate(ids, { onSuccess: () => markRecoFilterSynced(ids) });
      }
    },
    []
  );
}
