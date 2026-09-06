import { createContext, useContext } from "react";

/**
 * Vrai une fois `storage.hydrate()` terminé. Les magasins qui LISENT le
 * stockage à leur amorçage (mode hors ligne manuel, économie de données,
 * réglages d'appareil) doivent l'attendre : avant, le cache est vide et le
 * réglage repart à son défaut — « Passer hors ligne » ne survivait pas à un
 * redémarrage ni à un rechargement.
 */
export const StorageReadyContext = createContext(false);

export const useStorageReady = (): boolean => useContext(StorageReadyContext);
