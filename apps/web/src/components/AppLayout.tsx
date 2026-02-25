import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { MobileTabBar } from "./MobileTabBar";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { useIsMobile } from "../hooks/useIsMobile";

export function AppLayout() {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-tentacle-bg">
      {!isMobile && <Sidebar />}

      <div className={isMobile ? "pb-20 pt-14" : "pl-16"}>
        {/* Top bar: search + notifications */}
        <div className="fixed right-2 z-30 flex items-center gap-1 sm:right-4 sm:gap-2 safe-area-top" style={{ top: "max(0.5rem, env(safe-area-inset-top, 0.5rem))" }}>
          {isMobile && <NotificationBell />}
          <GlobalSearch />
        </div>

        <Outlet />
      </div>

      {isMobile && <MobileTabBar />}
    </div>
  );
}
