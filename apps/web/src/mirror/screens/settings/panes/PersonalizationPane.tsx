import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HOME_LAYOUT_KEY, RECO_SETTINGS_KEY } from "@tentacle-tv/api-client";
import { SettingsPersonalization } from "../../../../pages/settings/SettingsPersonalization";
import { LinkedAccounts } from "../../../../components/settings/personalization/LinkedAccounts";
import { useActiveProfile } from "../../../../auth/profileSession";
import { useOfflineMode } from "../../../../offline/useOfflineMode";

/**
 * `PersonalizationPane` de l'app : l'accueil (bandeau, densité, rangées), les
 * recommandations, puis « Comptes liés » (session invitée TMDB, file des
 * notes — `LinkedAccountsSection` de l'app). Le contenu est celui du web
 * (`SettingsPersonalization`, `LinkedAccounts`), réutilisé tel quel ; comme
 * l'app, le volet relit l'accueil et les recommandations à l'ouverture — ce
 * qu'un autre appareil a changé est là. « Comptes liés » jamais en session de
 * profil (le serveur y refuse `/api/external`) ni hors ligne.
 */
export function PersonalizationPane() {
  const qc = useQueryClient();
  const profile = useActiveProfile();
  const offline = useOfflineMode();
  const linked = profile === null && !offline;
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: HOME_LAYOUT_KEY });
    void qc.invalidateQueries({ queryKey: RECO_SETTINGS_KEY });
  }, [qc]);
  return (
    <>
      <SettingsPersonalization />
      {linked && (
        <div className="mt-6">
          <LinkedAccounts />
        </div>
      )}
    </>
  );
}
