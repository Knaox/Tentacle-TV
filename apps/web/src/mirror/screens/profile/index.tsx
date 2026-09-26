import { useCallback, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isDesktopApp } from "../../../desktop/bridge";
import { getUserInfo } from "../../../components/userMenu/menuItems";
import { useDesktopVersion } from "../../../hooks/useDesktopVersion";
import { useOfflineMode } from "../../../offline/useOfflineMode";
import { BACKEND } from "../../../pages/adminUtils";
import { RAIL_WIDTH } from "../../responsive";
import { HEADER_TOTAL } from "../../shell/metrics";
import { useSideNav, useViewport } from "../../useFormFactor";
import { useContentPadding } from "../../useMirrorLayout";
import { masterWidth, parsePaneParam, resolvePane, type MirrorPaneId, type PaneContext } from "../settings/panes";
import { useProfileSplit } from "../settings/useProfileSplit";
import { ProfileAccountSections } from "./ProfileAccountSections";
import { ProfileConfirmDialog } from "./ProfileConfirmDialog";
import { ProfileDetailPane } from "./ProfileDetailPane";
import { ProfileHero } from "./ProfileHero";
import { ProfilePaneContext } from "./ProfilePaneContext";
import { ProfileSettingsSections } from "./ProfileSettingsSections";
import { useProfileActions } from "./useProfileActions";
import "../../mirror.css";

/** Le bas des colonnes du maître-détail (`BOTTOM_CLEARANCE` de l'app). */
const BOTTOM_CLEARANCE = "120px";

/**
 * `/profile` — `ProfileScreen` de l'app : l'identité en tête, puis les
 * réglages en sections dont l'ordre et les règles vivent dans
 * `settings/panes.ts`.
 *
 * Téléphone : une seule liste (colonne `useContentPadding()`, 20 sous
 * l'en-tête) ; une ligne à chevron ouvre son écran `/settings/:pane`.
 * Tablette dont la largeur utile atteint 720 : maître-détail — la liste à
 * gauche (34 % de l'écran, bornée 320-400, filet à droite, marges 16), le
 * volet choisi à droite. Le volet choisi vit dans l'URL (`?pane=`) : un lien
 * `/settings/:pane` ouvert sur tablette y retombe. Les deux colonnes
 * défilent chacune sous le verre de l'en-tête.
 */
export function MirrorProfile() {
  const { t } = useTranslation("profile");
  const { name, initial, isAdmin } = getUserInfo();
  const offline = useOfflineMode();
  const ctx: PaneContext = useMemo(() => ({ offline, isAdmin }), [offline, isAdmin]);
  const actions = useProfileActions(isAdmin);
  const desktopVersion = useDesktopVersion();
  const version = isDesktopApp() ? desktopVersion : __APP_VERSION_WEB__;
  const serverUrl = localStorage.getItem("tentacle_server_url") || BACKEND || window.location.origin;

  const split = useProfileSplit();
  const { width } = useViewport();
  const sideNav = useSideNav();
  const contentPad = useContentPadding();
  const [params, setParams] = useSearchParams();
  const pane = resolvePane(parsePaneParam(params.get("pane")), ctx);
  const select = useCallback(
    (id: MirrorPaneId) => setParams({ pane: id }, { replace: true }),
    [setParams],
  );
  const selection = useMemo(() => ({ selected: pane, select }), [pane, select]);

  const list: ReactNode = (
    <>
      <ProfileHero name={name || t("defaultUsername")} initial={initial} isAdmin={isAdmin} serverUrl={serverUrl} />
      <ProfileSettingsSections ctx={ctx} />
      <ProfileAccountSections ctx={ctx} actions={actions} serverUrl={serverUrl} version={version} />
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

  return (
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
        <ProfileDetailPane pane={pane} bottomInset={BOTTOM_CLEARANCE} />
      </div>
      <ProfileConfirmDialog actions={actions} />
    </ProfilePaneContext.Provider>
  );
}
