import { Suspense, lazy } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { TopNav } from "./nav/TopNav";
import { TopNavMobile } from "./nav/TopNavMobile";
import { MobileTabBar } from "./MobileTabBar";
import { useIsMobile } from "../hooks/useIsMobile";
import { VersionBanner } from "./VersionBanner";
import { AdminKeyBanner } from "./AdminKeyBanner";
import { TmdbKeyBanner } from "./TmdbKeyBanner";
import { useLeaderboardOpen, closeLeaderboard } from "./easterEggs/logoEggStore";
import { useMirror } from "../mirror/useFormFactor";

/** Chargée à la demande : le bureau ne télécharge rien du miroir. */
const MirrorLayout = lazy(() => import("../mirror/shell/MirrorLayout").then((m) => ({ default: m.MirrorLayout })));

/**
 * Pages où la barre MOBILE ne propose pas la recherche (elle y manque de
 * place). Sur desktop, la recherche est au cœur de la barre, partout : une
 * barre qui change de forme d'une page à l'autre désoriente.
 */
const HIDE_SEARCH_ROUTES = ["/support", "/settings", "/about", "/admin", "/pair-device"];

/**
 * Chargé à la demande : tant que personne n'a cliqué quatre fois sur le logo,
 * pas un octet du panneau n'est téléchargé.
 */
const WatchLeaderboardPanel = lazy(() =>
  import("./easterEggs/WatchLeaderboardPanel").then((m) => ({ default: m.WatchLeaderboardPanel })),
);

/**
 * Téléphone et tablette : la coquille de l'app mobile (docs/WEB-MIROIR-MOBILE.md).
 * Bureau — fenêtre large et application Electron —, la mise en page d'avant.
 */
export function AppLayout() {
  const mirror = useMirror();
  if (mirror) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-surface-0" />}>
        <MirrorLayout />
      </Suspense>
    );
  }
  return <DesktopLayout />;
}

function DesktopLayout() {
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const showSearch = !HIDE_SEARCH_ROUTES.some((r) => pathname.startsWith(r));
  const leaderboardOpen = useLeaderboardOpen();

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Subtle brand ambient glow behind everything */}
      <div className="brand-ambient" aria-hidden />

      {isMobile ? (
        <TopNavMobile showSearch={showSearch} />
      ) : (
        <TopNav />
      )}

      <div
        className={isMobile ? "pt-[56px] pb-20" : "pt-[68px]"}
        style={isMobile ? {
          paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
        } : undefined}
      >
        <VersionBanner />
        <AdminKeyBanner />
        <TmdbKeyBanner />
        <Outlet />
      </div>

      {isMobile && <MobileTabBar />}

      {/* Un seul point de montage, quelle que soit la barre de navigation
          affichée — les deux logos alimentent le même compteur. */}
      {leaderboardOpen && (
        <Suspense fallback={null}>
          <WatchLeaderboardPanel onClose={closeLeaderboard} />
        </Suspense>
      )}
    </div>
  );
}
