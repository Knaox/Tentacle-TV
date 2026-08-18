import { Settings } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { IS_TVOS } from "./RNStorageAdapter";

/**
 * Cold start TV : cache home persisté via Settings (NSUserDefaults) sur tvOS,
 * AsyncStorage sur Android TV (Settings y est un no-op sans persistance) —
 * interface async attendue par le persister React Query. Extrait d'`App.tsx`
 * (budget de 300 lignes), rien n'a changé.
 *
 * ⚠️ tvOS abort l'app (SIGABRT, __CFPREFERENCES_HAS_DETECTED_THIS_APP_TRYING_TO_
 * STORE_TOO_MUCH_DATA__) au-delà d'une limite stricte du domaine NSUserDefaults
 * (~0,5 Mo). Le défaut 2 Mo du persister dépassait → crash « de temps en temps »
 * quand le cache home gonflait. On plafonne BIEN en dessous + garde-fou dur
 * (plafond conservé à l'identique sur Android : un cache home > 256 K n'apporte
 * rien au cold start et resterait à re-fetcher de toute façon).
 */
export const TV_PERSIST_MAX = 256 * 1024; // ~256 K caractères

export const tvPersistStorage = {
  getItem: (k: string) => {
    if (!IS_TVOS) return AsyncStorage.getItem(k);
    const v = Settings.get(k);
    return Promise.resolve(typeof v === "string" ? v : null);
  },
  // Jamais d'écriture surdimensionnée vers NSUserDefaults : au-delà de la limite
  // on PURGE la clé (null) au lieu d'écrire → impossible de crasher CFPreferences.
  setItem: (k: string, v: string) => {
    if (!IS_TVOS) {
      return v.length > TV_PERSIST_MAX ? AsyncStorage.removeItem(k) : AsyncStorage.setItem(k, v);
    }
    Settings.set({ [k]: v.length > TV_PERSIST_MAX ? null : v });
    return Promise.resolve();
  },
  removeItem: (k: string) => {
    if (!IS_TVOS) return AsyncStorage.removeItem(k);
    Settings.set({ [k]: null });
    return Promise.resolve();
  },
};
