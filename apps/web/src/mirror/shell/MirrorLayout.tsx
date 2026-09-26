import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { VersionBanner } from "../../components/VersionBanner";
import { AdminKeyBanner } from "../../components/AdminKeyBanner";
import { TmdbKeyBanner } from "../../components/TmdbKeyBanner";
import { useLeaderboardOpen, closeLeaderboard } from "../../components/easterEggs/logoEggStore";
import { RAIL_WIDTH } from "../responsive";
import { useSideNav } from "../useFormFactor";
import { MirrorChromeContext, RailWidthContext } from "../useMirrorLayout";
import { ExtensionPicker } from "./ExtensionPicker";
import { GlassTabBar } from "./GlassTabBar";
import { HEADER_TOTAL, TAB_BAR_TOTAL } from "./metrics";
import { MirrorHeader } from "./MirrorHeader";
import { RailMenu } from "./RailMenu";
import { TabRail } from "./TabRail";
import { useChromeCollapsed, useResetChromeOnNavigate } from "./scrollChrome";
import { useMirrorTabs } from "./useMirrorTabs";
import "../mirror.css";

/**
 * Les écrans plein cadre de l'app (la recherche est une modale) : ni en-tête
 * ni barre ni marge, l'écran gère lui-même ses zones sûres.
 */
const IMMERSIVE_ROUTES = ["/search"];

/**
 * Les écrans EMPILÉS par-dessus les onglets dans l'app (`app/library/…`,
 * `app/watchlist.tsx`…) : pas d'en-tête persistant ni de barre ni de rail ;
 * l'écran porte son propre en-tête à retour, sous `max(zone sûre, 24)`.
 */
const STACKED_ROUTES = ["/library", "/watchlist", "/favorites", "/about", "/credits", "/support", "/pair-device", "/on-device", "/offline", "/settings"];

const matches = (pathname: string, routes: string[]) =>
  routes.some((r) => pathname === r || pathname.startsWith(`${r}/`));

const WatchLeaderboardPanel = lazy(() =>
  import("../../components/easterEggs/WatchLeaderboardPanel").then((m) => ({ default: m.WatchLeaderboardPanel })),
);

/**
 * La coquille du miroir (`app/(tabs)/_layout.tsx` de l'app) : l'en-tête de
 * verre flotte en haut ; en bas, la barre d'onglets flottante — ou, sur l'iPad
 * en paysage, le rail de 76 et son tiroir.
 *
 * Comme les écrans de l'app, le contenu commence sous l'en-tête et finit
 * au-dessus de la barre ; en défilant, il passe SOUS le verre. Un écran qui
 * veut déborder sous l'en-tête (le visuel d'une bibliothèque) remonte de
 * `HEADER_TOTAL` lui-même.
 */
export function MirrorLayout() {
  const { pathname } = useLocation();
  if (matches(pathname, IMMERSIVE_ROUTES)) {
    return (
      <MirrorChromeContext.Provider value="stacked">
        <div className="min-h-screen bg-surface-0">
          <Outlet />
        </div>
      </MirrorChromeContext.Provider>
    );
  }
  if (matches(pathname, STACKED_ROUTES)) {
    return (
      <MirrorChromeContext.Provider value="stacked">
        <div
          className="min-h-screen bg-surface-0"
          style={{
            paddingTop: "max(env(safe-area-inset-top, 0px), 24px)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
            paddingLeft: "env(safe-area-inset-left, 0px)",
            paddingRight: "env(safe-area-inset-right, 0px)",
          }}
        >
          <Outlet />
        </div>
      </MirrorChromeContext.Provider>
    );
  }
  return <TabsLayout />;
}

function TabsLayout() {
  const navigate = useNavigate();
  const sideNav = useSideNav();
  const collapsed = useChromeCollapsed();
  useResetChromeOnNavigate();
  const { tabs, plugins, activePlugin } = useMirrorTabs();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const leaderboardOpen = useLeaderboardOpen();

  useEffect(() => {
    if (!sideNav) setMenuOpen(false);
  }, [sideNav]);

  const toggleExtensions = useCallback(() => setPickerOpen((o) => !o), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const openMenu = useCallback(() => setMenuOpen(true), []);

  return (
    <RailWidthContext.Provider value={sideNav ? RAIL_WIDTH : 0}>
    <MirrorChromeContext.Provider value={sideNav ? "rail" : "tabs"}>
      <div className="min-h-screen bg-surface-0">
        <div
          style={{
            paddingTop: HEADER_TOTAL,
            paddingBottom: sideNav ? 24 : `calc(${TAB_BAR_TOTAL} + 24px)`,
            paddingLeft: sideNav ? `calc(${RAIL_WIDTH}px + env(safe-area-inset-left, 0px))` : undefined,
          }}
        >
          <VersionBanner />
          <AdminKeyBanner />
          <TmdbKeyBanner />
          <Outlet />
        </div>

        <MirrorHeader collapsed={!sideNav && collapsed} />
        {sideNav ? (
          <>
            <TabRail tabs={tabs} onOpenMenu={openMenu} onExtensions={toggleExtensions} />
            <RailMenu open={menuOpen} onClose={closeMenu} tabs={tabs} plugins={plugins} activePlugin={activePlugin} />
          </>
        ) : (
          <GlassTabBar tabs={tabs} collapsed={collapsed} onExtensions={toggleExtensions} />
        )}
        <ExtensionPicker
          open={pickerOpen && plugins.length > 1}
          plugins={plugins}
          activePluginId={activePlugin?.pluginId}
          sideNav={sideNav}
          onSelect={(path) => {
            closePicker();
            navigate(path);
          }}
          onClose={closePicker}
        />

        {leaderboardOpen && (
          <Suspense fallback={null}>
            <WatchLeaderboardPanel onClose={closeLeaderboard} />
          </Suspense>
        )}
      </div>
    </MirrorChromeContext.Provider>
    </RailWidthContext.Provider>
  );
}
