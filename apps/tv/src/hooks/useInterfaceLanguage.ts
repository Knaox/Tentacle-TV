import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSetInterfaceLanguage, useTentacleConfig } from "@tentacle-tv/api-client";

/**
 * La langue de l'interface, depuis les réglages : l'écran se retraduit, le
 * choix reste sur l'appareil (`tentacle_language`) et suit le compte (serveur :
 * le téléphone et le web la retrouvent). Au jumelage, sans compte, seul
 * l'appareil la retient (`usePairingFlow`).
 */
export function useInterfaceLanguage() {
  const { i18n } = useTranslation();
  const { storage } = useTentacleConfig();
  const { mutate: saveForAccount } = useSetInterfaceLanguage();

  const change = useCallback((code: string) => {
    i18n.changeLanguage(code);
    storage.setItem("tentacle_language", code);
    saveForAccount(code);
  }, [i18n, storage, saveForAccount]);

  return { language: i18n.language, change };
}
