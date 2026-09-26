import { Navigate, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOfflineMode } from "../../../offline/useOfflineMode";
import { getUserInfo } from "../../../components/userMenu/menuItems";
import { PANE_REGISTRY } from "./paneRegistry";
import { isPaneAvailable, parsePaneParam, profilePaneRoute } from "./panes";
import { SettingsScaffold } from "./ui/SettingsScaffold";
import { useProfileSplit } from "./useProfileSplit";

/**
 * `/settings/:pane` — un volet du profil en écran plein (les écrans
 * `app/settings/*.tsx` de l'app, habillés de `SettingsScaffold`).
 *
 * Sur une tablette en maître-détail, l'écran n'existe pas : on renvoie au
 * profil, volet sélectionné. Un volet inconnu, retiré (hors ligne, pas
 * administrateur) ou sans équivalent miroir (`appearance`, `downloads`)
 * renvoie au profil. `security` (ancienne route du web) ouvre le mot de passe.
 */
export function MirrorSettingsPane() {
  // Monté comme élément de la route parente `settings` (le bureau y garde ses
  // routes enfants) : le volet se lit alors dans le chemin.
  const params = useParams<{ pane: string }>();
  const { pathname } = useLocation();
  const raw = params.pane ?? pathname.split("/")[2];
  const { t } = useTranslation();
  const split = useProfileSplit();
  const offline = useOfflineMode();
  const { isAdmin } = getUserInfo();
  const pane = parsePaneParam(raw);

  if (!pane || !isPaneAvailable(pane, { offline, isAdmin })) return <Navigate to="/profile" replace />;
  if (split) return <Navigate to={profilePaneRoute(pane)} replace />;

  const { Component, title, maxWidth } = PANE_REGISTRY[pane];
  return (
    <SettingsScaffold title={t(title.key, { ns: title.ns })} maxWidth={maxWidth}>
      <Component />
    </SettingsScaffold>
  );
}
