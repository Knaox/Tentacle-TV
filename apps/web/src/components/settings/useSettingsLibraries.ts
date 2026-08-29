/**
 * La liste des bibliothèques, en ligne comme hors ligne.
 *
 * Les réglages de lecture en ont besoin pour cibler une règle, et la page des
 * préférences la construisait déjà pour ses cartes de langue. La sortir ici
 * évite de la refaire une seconde fois, et surtout de refaire l'oubli qui
 * guette : hors ligne, `useLibraries` ne répond jamais — c'est le cache posé
 * par la dernière visite (`readLibrariesList`) qui fait foi.
 */

import { useMemo } from "react";
import { useLibraries, useUserId } from "@tentacle-tv/api-client";
import { readLibrariesList } from "../../offline/localTrackPrefs";
import { useOfflineMode } from "../../offline/useOfflineMode";

export interface SettingsLibrary {
  id: string;
  name: string;
}

export function useSettingsLibraries(): SettingsLibrary[] {
  const offline = useOfflineMode();
  const userId = useUserId();
  const { data: libraries } = useLibraries({ enabled: !offline });

  return useMemo(() => {
    if (offline) {
      return userId ? readLibrariesList(userId).map((lib) => ({ id: lib.id, name: lib.name })) : [];
    }
    return (libraries ?? []).map((lib) => ({ id: lib.Id, name: lib.Name }));
  }, [offline, userId, libraries]);
}
