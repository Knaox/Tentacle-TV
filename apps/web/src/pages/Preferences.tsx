import { useLocation } from "react-router-dom";
import { SettingsLanguages } from "./settings/SettingsLanguages";
import { SettingsPlayback } from "./settings/SettingsPlayback";

/**
 * Le module paresseux des rubriques Lecture (`/settings/playback`) et Langues
 * et sous-titres (`/settings/languages`) — `lazyPages.ts` › `Preferences`.
 * Une rubrique de plus n'ajoute pas d'entrée à `lazyPages.ts` : la cible LG
 * le substitue (`lazyPagesTv.tsx`) et casserait sur une export inconnue. La
 * rubrique se lit donc dans l'adresse, sans prop (la page LG n'en a pas).
 */
export function Preferences() {
  const { pathname } = useLocation();
  return /\/settings\/languages\/?$/.test(pathname) ? <SettingsLanguages /> : <SettingsPlayback />;
}
