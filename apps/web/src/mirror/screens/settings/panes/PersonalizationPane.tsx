import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HOME_LAYOUT_KEY, RECO_SETTINGS_KEY } from "@tentacle-tv/api-client";
import { SettingsPersonalization } from "../../../../pages/settings/SettingsPersonalization";

/**
 * `PersonalizationPane` de l'app : l'accueil (bandeau, densité, rangées) et
 * les recommandations. Le contenu est la page web `SettingsPersonalization`,
 * réutilisée telle quelle (lecture avant écriture, curseur différé, Vigie) ;
 * comme l'app, le volet relit les deux blocs à l'ouverture — ce qu'un autre
 * appareil a changé est là.
 */
export function PersonalizationPane() {
  const qc = useQueryClient();
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: HOME_LAYOUT_KEY });
    void qc.invalidateQueries({ queryKey: RECO_SETTINGS_KEY });
  }, [qc]);
  return <SettingsPersonalization />;
}
