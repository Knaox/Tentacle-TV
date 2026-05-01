import { Link } from "react-router-dom";
import { TopNavLinks } from "./TopNavLinks";
import { useScrollOpacity } from "./useScrollOpacity";
import { GlobalSearch } from "../GlobalSearch";
import { NotificationBell } from "../NotificationBell";
import { UserAvatarMenu } from "../UserAvatarMenu";
import { TentacleLogo } from "../ui/TentacleLogo";

interface TopNavProps {
  showSearch?: boolean;
}

/**
 * Desktop horizontal top navigation — replaces the legacy 62px sidebar.
 * Behaviour: fully transparent at scroll=0, fades to opaque black with a subtle
 * bottom border once content scrolls underneath. Mirrors the Netflix pattern.
 */
export function TopNav({ showSearch = true }: TopNavProps) {
  const scrollProgress = useScrollOpacity(120);

  // Background opacity ramps faster than border so border barely shows over hero.
  const bgOpacity = Math.min(0.92, scrollProgress * 1.2);
  const borderOpacity = scrollProgress > 0.95 ? 0.08 : 0;

  return (
    <header
      data-host-chrome="topbar"
      className="fixed inset-x-0 top-0 z-40 h-[68px] transition-colors duration-300"
      style={{
        background: `rgba(0, 0, 0, ${bgOpacity})`,
        borderBottom: `1px solid rgba(255, 255, 255, ${borderOpacity})`,
        backdropFilter: scrollProgress > 0.3 ? "blur(12px)" : "none",
        WebkitBackdropFilter: scrollProgress > 0.3 ? "blur(12px)" : "none",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div className="flex h-full items-center gap-6 px-4 md:px-12">
        <Link
          to="/"
          className="flex flex-shrink-0 items-center gap-2.5 transition-opacity duration-200 hover:opacity-80"
          aria-label="Tentacle TV — Accueil"
        >
          <TentacleLogo size="md" variant="bare" />
          <span
            className="hidden text-base font-bold tracking-tight text-white sm:inline"
            style={{ letterSpacing: "-0.02em" }}
          >
            Tentacle
          </span>
        </Link>

        {/* Primary nav (horizontal) */}
        <div className="min-w-0 flex-1">
          <TopNavLinks />
        </div>

        {/* Right cluster: search + notif + avatar */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {showSearch && <GlobalSearch />}
          <NotificationBell />
          <UserAvatarMenu />
        </div>
      </div>
    </header>
  );
}
