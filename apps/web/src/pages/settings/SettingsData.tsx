import { Navigate } from "react-router-dom";
import { WIDE_LEGACY_PATHS } from "@tentacle-tv/shared";

/**
 * `/settings/data` — l'ancienne rubrique « Données » (une seule ligne,
 * l'économie de données). Le réglage vit désormais dans Lecture › Connexion
 * (`DataSaverSetting`) : l'adresse y mène. L'export reste (la cible LG
 * substitue `lazyPages.ts` et garde CETTE adresse pour son écran Compte).
 */
export function SettingsData() {
  return <Navigate to={WIDE_LEGACY_PATHS.data} replace />;
}
