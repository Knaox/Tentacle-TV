import { Navigate, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isSettingsEntryVisible, SETTINGS_SECTIONS } from "@tentacle-tv/shared";
import { useFamilySettingsAvailability } from "../../../family/useFamilyAvailability";
import { SettingsFamily } from "../../../pages/settings/SettingsFamily";
import { useWebSettingsContext } from "./catalog/useWebSettingsContext";
import { parseSettingsSegment, webSectionRoute, type WebPaneId } from "./catalog/webCatalog";
import { PANE_REGISTRY } from "./paneRegistry";
import { SettingsScaffold } from "./ui/SettingsScaffold";
import { useProfileSplit } from "./useProfileSplit";

/**
 * `/settings/:pane` — un volet du catalogue partagé en écran plein (les
 * écrans `app/settings/*.tsx` de l'app, habillés de `SettingsScaffold`).
 *
 * Le volet doit être visible ICI (le catalogue et le contexte du web en
 * décident : hors ligne, pas administrateur, session de profil…), sinon
 * retour au profil. Sur une tablette en maître-détail, il s'ouvre dans la
 * colonne de détail de sa rubrique. Les anciennes pages (`playback`, `data`,
 * `appearance`…) mènent à la rubrique qui les a recueillies ; `family` reste
 * la page Famille du bureau.
 */
export function MirrorSettingsPane() {
  // Monté comme élément de la route parente `settings` (le bureau y garde ses
  // routes enfants) : le volet se lit alors dans le chemin.
  const params = useParams<{ pane: string }>();
  const { pathname } = useLocation();
  const raw = params.pane ?? pathname.split("/")[2];
  const { t } = useTranslation();
  const split = useProfileSplit();
  const ctx = useWebSettingsContext();
  const { available: family, settled: familySettled } = useFamilySettingsAvailability();
  const target = parseSettingsSegment(raw);

  if (target.kind === "family") {
    // La Famille dépend de `/api/config` : on attend sa réponse avant de conclure.
    if (!familySettled) return null;
    if (!family || ctx.offline) return <Navigate to="/profile" replace />;
    return (
      <SettingsScaffold title={t("nav", { ns: "familyWeb" })}>
        <SettingsFamily />
      </SettingsScaffold>
    );
  }
  if (target.kind === "section") return <Navigate to={webSectionRoute(target.id)} replace />;
  if (target.kind === "profile") return <Navigate to="/profile" replace />;

  const home = paneHome(target.id, ctx);
  if (!home) return <Navigate to="/profile" replace />;
  if (split) return <Navigate to={webSectionRoute(home, target.id)} replace />;

  const { Component, title, maxWidth } = PANE_REGISTRY[target.id];
  return (
    <SettingsScaffold title={t(title.key, { ns: title.ns })} maxWidth={maxWidth}>
      <Component />
    </SettingsScaffold>
  );
}

/** La rubrique qui range ce volet, s'il est visible dans ce contexte. */
function paneHome(pane: WebPaneId, ctx: ReturnType<typeof useWebSettingsContext>) {
  return SETTINGS_SECTIONS.find((section) =>
    section.groups.some((group) => group.entries.some((entry) => entry.kind === "pane" && entry.id === pane && isSettingsEntryVisible(entry, ctx))),
  )?.id;
}
