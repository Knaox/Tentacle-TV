import { useCallback, useMemo, type ReactNode } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  findSettingsSection, isSettingsEntryVisible, resolveSettingsSection, settingsSectionTarget, visibleSettingsGroups,
  type SettingsCatalogContext, type SettingsCatalogSection,
} from "@tentacle-tv/shared";
import { isDesktopApp } from "../../../desktop/bridge";
import { getUserInfo } from "../../../components/userMenu/menuItems";
import { useDesktopVersion } from "../../../hooks/useDesktopVersion";
import { BACKEND } from "../../../pages/adminUtils";
import { RAIL_WIDTH } from "../../responsive";
import { HEADER_TOTAL } from "../../shell/metrics";
import { useSideNav, useViewport } from "../../useFormFactor";
import { useContentPadding } from "../../useMirrorLayout";
import { CatalogActionsContext } from "../settings/catalog/CatalogEntryRow";
import { CatalogSectionBody } from "../settings/catalog/CatalogSectionBody";
import { CatalogSectionList } from "../settings/catalog/CatalogSectionList";
import { useWebSettingsContext } from "../settings/catalog/useWebSettingsContext";
import { isWebPane, parseSettingsSegment, webPaneRoute, webSectionRoute, type WebPaneId } from "../settings/catalog/webCatalog";
import { masterWidth } from "../settings/panes";
import { PANE_REGISTRY } from "../settings/paneRegistry";
import { SettingsScaffold } from "../settings/ui/SettingsScaffold";
import { useProfileSplit } from "../settings/useProfileSplit";
import { ProfileConfirmDialog } from "./ProfileConfirmDialog";
import { ProfileDetailPane } from "./ProfileDetailPane";
import { ProfileFooter, ProfileStatsCard } from "./ProfileFooter";
import { ProfileHero } from "./ProfileHero";
import { ProfilePaneContext } from "./ProfilePaneContext";
import { useProfileActions } from "./useProfileActions";
import "../../mirror.css";

/** Le bas des colonnes du maître-détail (`BOTTOM_CLEARANCE` de l'app). */
const BOTTOM_CLEARANCE = "120px";

/** Le volet visé par `?pane=` existe-t-il dans une page de cette rubrique, ici ? */
function paneInSection(section: SettingsCatalogSection, pane: WebPaneId, ctx: SettingsCatalogContext): boolean {
  return visibleSettingsGroups(section, ctx).some((group) =>
    group.entries.some((entry) => entry.kind === "pane" && entry.id === pane && isSettingsEntryVisible(entry, ctx)));
}

/**
 * `/profile` et `/profile/:section` — `ProfileScreen` de l'app, rendu depuis
 * le CATALOGUE PARTAGÉ des réglages (`@tentacle-tv/shared` › settingsCatalog) :
 * l'identité, « Mes statistiques », les rubriques, « Se déconnecter ».
 *
 * Téléphone : `/profile` est la liste ; une rubrique ouvre sa page
 * (`/profile/<rubrique>`), une ligne de la page ouvre son volet
 * (`/settings/<volet>`) — deux niveaux, jamais trois. Tablette dont la
 * largeur utile atteint 720 : les rubriques à gauche, la page à droite, et
 * ses volets dans la même colonne (`?pane=`, « ‹ Rubrique » pour remonter).
 */
export function MirrorProfile() {
  const { t } = useTranslation(["profile", "settingsMobile"]);
  const { name, initial, isAdmin } = getUserInfo();
  const ctx = useWebSettingsContext();
  const actions = useProfileActions(isAdmin);
  const desktopVersion = useDesktopVersion();
  const version = isDesktopApp() ? desktopVersion : __APP_VERSION_WEB__;
  const serverUrl = localStorage.getItem("tentacle_server_url") || BACKEND || window.location.origin;
  const navigate = useNavigate();

  const split = useProfileSplit();
  const { width } = useViewport();
  const sideNav = useSideNav();
  const contentPad = useContentPadding();
  const { section: rawSection } = useParams<{ section?: string }>();
  const [params] = useSearchParams();
  const requested = rawSection ? findSettingsSection(rawSection) : undefined;
  const sectionId = split ? resolveSettingsSection(requested?.id ?? null, ctx) : requested?.id ?? null;
  const section = sectionId ? findSettingsSection(sectionId) : undefined;
  const paneTarget = parseSettingsSegment(params.get("pane"));
  const pane = paneTarget.kind === "pane" && section && paneInSection(section, paneTarget.id, ctx) ? paneTarget.id : null;

  const selectSection = useCallback((id: string) => navigate(webSectionRoute(id as SettingsCatalogSection["id"]), { replace: true }), [navigate]);
  const selection = useMemo(() => ({
    selected: pane,
    select: (id: WebPaneId) => section && navigate(webSectionRoute(section.id, id), { replace: true }),
  }), [pane, section, navigate]);

  const sectionTitle = section ? t(section.label.key, { ns: section.label.ns }) : "";

  // Téléphone, une rubrique : sa page empilée (ou, si elle n'a qu'un volet, ce volet).
  if (!split && rawSection) {
    if (!section || !visibleSettingsGroups(section, ctx).length) return <Navigate to="/profile" replace />;
    const target = settingsSectionTarget(section, ctx);
    if (target.kind === "pane" && isWebPane(target.id)) return <Navigate to={webPaneRoute(target.id)} replace />;
    return (
      <CatalogActionsContext.Provider value={actions}>
        <SettingsScaffold title={sectionTitle}>
          <CatalogSectionBody section={section} ctx={ctx} />
        </SettingsScaffold>
        <ProfileConfirmDialog actions={actions} />
      </CatalogActionsContext.Provider>
    );
  }

  const list: ReactNode = (
    <>
      <ProfileHero name={name || t("defaultUsername")} initial={initial} isAdmin={isAdmin} serverUrl={serverUrl} />
      <ProfileStatsCard offline={ctx.offline} />
      <CatalogSectionList ctx={ctx} selected={split ? sectionId : undefined} onSelect={split ? selectSection : undefined} />
      <ProfileFooter onLogout={actions.handleLogout} version={version} />
    </>
  );

  if (!split) {
    return (
      <div className="pt-5" style={{ paddingInline: contentPad }}>
        {list}
        <ProfileConfirmDialog actions={actions} />
      </div>
    );
  }

  const detail = pane ? PANE_REGISTRY[pane] : null;
  return (
    <CatalogActionsContext.Provider value={actions}>
      <ProfilePaneContext.Provider value={selection}>
        <div
          className="fixed inset-y-0 right-0 flex bg-surface-0"
          style={{ left: sideNav ? `calc(${RAIL_WIDTH}px + env(safe-area-inset-left, 0px))` : 0 }}
        >
          <div
            className="h-full shrink-0 overflow-y-auto overscroll-contain border-r border-line-subtle px-4 mirror-no-scrollbar"
            style={{ width: masterWidth(width), paddingTop: `calc(${HEADER_TOTAL} + 20px)`, paddingBottom: BOTTOM_CLEARANCE }}
          >
            {list}
          </div>
          {section && (detail ? (
            <ProfileDetailPane
              key={`${section.id}:${pane}`}
              title={t(detail.title.key, { ns: detail.title.ns })}
              back={settingsSectionTarget(section, ctx).kind === "page" ? { label: sectionTitle, onPress: () => selectSection(section.id) } : undefined}
              bottomInset={BOTTOM_CLEARANCE}
            >
              <detail.Component />
            </ProfileDetailPane>
          ) : (
            <SectionDetail key={section.id} section={section} ctx={ctx} title={sectionTitle} />
          ))}
        </div>
        <ProfileConfirmDialog actions={actions} />
      </ProfilePaneContext.Provider>
    </CatalogActionsContext.Provider>
  );
}

/** La page d'une rubrique dans la colonne de détail ; une rubrique d'un seul volet montre ce volet. */
function SectionDetail({ section, ctx, title }: { section: SettingsCatalogSection; ctx: SettingsCatalogContext; title: string }) {
  const { t } = useTranslation();
  const target = settingsSectionTarget(section, ctx);
  if (target.kind === "pane" && isWebPane(target.id)) {
    const { Component, title: paneTitle } = PANE_REGISTRY[target.id];
    return (
      <ProfileDetailPane title={t(paneTitle.key, { ns: paneTitle.ns })} bottomInset={BOTTOM_CLEARANCE}>
        <Component />
      </ProfileDetailPane>
    );
  }
  return (
    <ProfileDetailPane title={title} bottomInset={BOTTOM_CLEARANCE}>
      <CatalogSectionBody section={section} ctx={ctx} />
    </ProfileDetailPane>
  );
}
