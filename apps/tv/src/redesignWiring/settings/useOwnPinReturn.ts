import { useCallback, type MutableRefObject } from "react";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { ownPinModes, readProfileRecord, settingsPinReturnKey } from "@tentacle-tv/tv-core";

/**
 * Le retour du pavé de son code PIN dans Réglages › Compte (`onReturn` de
 * l'écran) : le focus rejoint le premier geste de la section telle qu'elle
 * est devenue (tv-core `settingsPinReturnKey`) — le bouton qui avait ouvert
 * le pavé a pu disparaître (créer ↔ changer, retirer). Le profil est relu à
 * l'instant du retour : le pavé vient de le mettre à jour.
 */
export function useOwnPinReturn(opened: MutableRefObject<boolean>): (contentKey: string | null) => string | null {
  const { storage } = useTentacleConfig();
  return useCallback(
    (contentKey: string | null) => {
      if (!opened.current) return contentKey;
      opened.current = false;
      const record = readProfileRecord(storage);
      return (record ? settingsPinReturnKey(ownPinModes(record.kind, record.hasPin)) : null) ?? contentKey;
    },
    [opened, storage],
  );
}
