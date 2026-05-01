import { Link } from "react-router-dom";
import { useScrollOpacity } from "./useScrollOpacity";
import { GlobalSearch } from "../GlobalSearch";
import { NotificationBell } from "../NotificationBell";
import { TentacleLogo } from "../ui/TentacleLogo";

interface TopNavMobileProps {
  showSearch?: boolean;
}

/**
 * Mobile top bar — minimal: logo (left), search + notification (right).
 * The MobileTabBar at the bottom handles primary navigation.
 */
export function TopNavMobile({ showSearch = true }: TopNavMobileProps) {
  const scrollProgress = useScrollOpacity(80);
  const bgOpacity = Math.min(0.9, scrollProgress * 1.2);

  return (
    <header
      data-host-chrome="topbar-mobile"
      className="fixed inset-x-0 top-0 z-40 h-[56px] transition-colors duration-300"
      style={{
        background: `rgba(0, 0, 0, ${bgOpacity})`,
        backdropFilter: scrollProgress > 0.3 ? "blur(10px)" : "none",
        WebkitBackdropFilter: scrollProgress > 0.3 ? "blur(10px)" : "none",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      <div className="flex h-full items-center justify-between px-3">
        <Link
          to="/"
          className="flex flex-shrink-0 items-center"
          aria-label="Tentacle TV — Accueil"
        >
          <TentacleLogo size="sm" variant="pill" />
        </Link>

        <div className="flex flex-shrink-0 items-center gap-2">
          {showSearch && <GlobalSearch />}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
