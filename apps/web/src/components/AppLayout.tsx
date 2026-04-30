import { Outlet, useLocation } from "react-router-dom";
import { TopNav } from "./nav/TopNav";
import { TopNavMobile } from "./nav/TopNavMobile";
import { MobileTabBar } from "./MobileTabBar";
import { useIsMobile } from "../hooks/useIsMobile";

const HIDE_SEARCH_ROUTES = ["/support", "/settings", "/about", "/admin", "/pair-device"];

export function AppLayout() {
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const showSearch = !HIDE_SEARCH_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Subtle brand ambient glow behind everything */}
      <div className="brand-ambient" aria-hidden />

      {isMobile ? (
        <TopNavMobile showSearch={showSearch} />
      ) : (
        <TopNav showSearch={showSearch} />
      )}

      <div
        className={isMobile ? "pt-[56px] pb-20" : "pt-[68px]"}
        style={isMobile ? {
          paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
        } : undefined}
      >
        <Outlet />
      </div>

      {isMobile && <MobileTabBar />}
    </div>
  );
}
