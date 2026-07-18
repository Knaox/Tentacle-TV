import { Link } from "react-router-dom";
import { TopNavLinks } from "./TopNavLinks";
import { useScrollOpacity } from "./useScrollOpacity";
import { GlobalSearch } from "../GlobalSearch";
import { NotificationBell } from "../NotificationBell";
import { UserAvatarMenu } from "../UserAvatarMenu";
import { TentacleLogo } from "../ui/TentacleLogo";
import { BrowseButton } from "./BrowseButton";
import { WatchTogetherButton } from "../../watchTogether/WatchTogetherButton";

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

  // Baseline opacity 0.28 even at scroll=0 garantit la lisibilité du nav par-dessus
  // n'importe quel backdrop hero ; ramp jusqu'à 0.92 au scroll pour rester
  // cohérent avec le pattern Netflix « transparent en haut, opaque sur les rows ».
  const bgOpacity = Math.min(0.92, 0.28 + scrollProgress * 0.85);
  const borderOpacity = scrollProgress > 0.95 ? 0.08 : 0;

  return (
    <header
      data-host-chrome="topbar"
      className="fixed inset-x-0 top-0 z-40 h-[68px] transition-colors duration-300"
      style={{
        // Fond + bordure : opacité pilotée en JS au scroll, non migrée (cf. note
        // de mission — refonte prévue dans une phase ultérieure dédiée au chrome nav).
        background: `rgba(0, 0, 0, ${bgOpacity})`,
        borderBottom: `1px solid rgba(255, 255, 255, ${borderOpacity})`,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
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
            className="hidden text-base font-bold tracking-tight text-content-primary sm:inline"
            style={{ letterSpacing: "-0.02em" }}
          >
            Tentacle
          </span>
        </Link>

        {/* Browse menu (libraries pin manager) */}
        <BrowseButton />

        {/* Primary nav (horizontal) — only shows pinned items */}
        <div className="min-w-0 flex-1">
          <TopNavLinks />
        </div>

        {/* Right cluster: search + watch-together + notif + avatar */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {showSearch && <GlobalSearch />}
          <WatchTogetherButton />
          <NotificationBell />
          <UserAvatarMenu />
        </div>
      </div>
    </header>
  );
}
