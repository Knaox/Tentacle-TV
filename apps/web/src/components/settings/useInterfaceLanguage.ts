import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useSetInterfaceLanguage } from "@tentacle-tv/api-client";
import { clearPendingInterfaceLanguage, markInterfaceLanguagePending } from "../../offline/pendingPrefs";
import { useOfflineMode } from "../../offline/useOfflineMode";

/** Les langues de l'interface proposées dans les réglages. */
export const INTERFACE_LANGUAGE_CODES = ["fr", "en"] as const;
export type InterfaceLanguageCode = (typeof INTERFACE_LANGUAGE_CODES)[number];

/**
 * LE geste « changer la langue de l'interface », une seule fois pour tous les
 * réglages qui l'offrent (Réglages d'Octave, l'app étroite, Réglages › Langues
 * de Tentacle) : réglage du COMPTE — langue locale aussitôt
 * (`tentacle_language`, que le démarrage lit), envoi au serveur en ligne, file
 * d'attente hors ligne (`markInterfaceLanguagePending`, poussée au retour), puis
 * les requêtes relues dans la nouvelle langue.
 *
 * ⚠️ `tentacle_language` est traversée par une chaîne : jamais renommée.
 */
export function useInterfaceLanguage(): { language: InterfaceLanguageCode; setLanguage: (lng: string) => void } {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const offline = useOfflineMode();
  const { mutate } = useSetInterfaceLanguage();
  const language: InterfaceLanguageCode = i18n.language?.startsWith("fr") ? "fr" : "en";

  const setLanguage = useCallback((lng: string) => {
    void i18n.changeLanguage(lng);
    localStorage.setItem("tentacle_language", lng);
    if (offline) {
      markInterfaceLanguagePending(lng);
    } else {
      clearPendingInterfaceLanguage();
      mutate(lng);
    }
    void queryClient.invalidateQueries();
  }, [i18n, offline, mutate, queryClient]);

  return { language, setLanguage };
}
