import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { MobileTabBar } from "./MobileTabBar";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { UserAvatarMenu } from "./UserAvatarMenu";
import { useIsMobile } from "../hooks/useIsMobile";

const HIDE_SEARCH_ROUTES = ["/support", "/settings", "/about", "/admin", "/pair-device"];

export function AppLayout() {
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const showSearch = !HIDE_SEARCH_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <div className="min-h-screen bg-tentacle-bg">
      {/* Ambient background glow */}
      <div className="ambient-glow" />

      {!isMobile && <div data-host-chrome="sidebar"><Sidebar /></div>}

      <div className={isMobile ? "pb-20 pt-14" : "pl-[62px]"}>
        {/* Top bar: search + notifications + avatar */}
        <div
          data-host-chrome="topbar"
          className="fixed right-2 z-30 flex items-center gap-2 sm:right-4"
          style={{ top: "max(0.75rem, env(safe-area-inset-top, 0.75rem))" }}
        >
          {showSearch && <GlobalSearch />}
          {!isMobile && <NotificationBell />}
          {isMobile && <NotificationBell />}
          {!isMobile && <UserAvatarMenu />}
        </div>

        <Outlet />
      </div>

      {isMobile && <MobileTabBar />}
    </div>
  );
}
