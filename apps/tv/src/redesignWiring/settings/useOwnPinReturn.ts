import { useCallback, type MutableRefObject } from "react";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { ownPinModesFor, readProfileRecord, recordManageState, settingsPinReturnKey } from "@tentacle-tv/tv-core";

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
      const modes = record
        ? ownPinModesFor({ kind: record.kind, hasPin: record.hasPin, manage: recordManageState(record), launch: record.launch, alone: null })
        : null;
      return (modes ? settingsPinReturnKey(modes) : null) ?? contentKey;
    },
    [opened, storage],
  );
}
