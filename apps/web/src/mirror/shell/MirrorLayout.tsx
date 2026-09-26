import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { VersionBanner } from "../../components/VersionBanner";
import { AdminKeyBanner } from "../../components/AdminKeyBanner";
import { TmdbKeyBanner } from "../../components/TmdbKeyBanner";
import { useLeaderboardOpen, closeLeaderboard } from "../../components/easterEggs/logoEggStore";
import { RAIL_WIDTH } from "../responsive";
import { useSideNav } from "../useFormFactor";
import { RailWidthContext } from "../useMirrorLayout";
import { ExtensionPicker } from "./ExtensionPicker";
import { GlassTabBar } from "./GlassTabBar";
import { HEADER_TOTAL, TAB_BAR_TOTAL } from "./metrics";
import { MirrorHeader } from "./MirrorHeader";
import { RailMenu } from "./RailMenu";
import { TabRail } from "./TabRail";
import { useChromeCollapsed, useResetChromeOnNavigate } from "./scrollChrome";
import { useMirrorTabs } from "./useMirrorTabs";
import "../mirror.css";

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
    </RailWidthContext.Provider>
  );
}
