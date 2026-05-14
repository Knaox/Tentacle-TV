import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useScrollOpacity } from "./useScrollOpacity";
import { GlobalSearch } from "../GlobalSearch";
import { NotificationBell } from "../NotificationBell";
import { TentacleLogo } from "../ui/TentacleLogo";
import { MobileUserSheet } from "../MobileUserSheet";
import { AVATAR_RING_STYLE, getUserInfo } from "../userMenu/menuItems";

interface TopNavMobileProps {
  showSearch?: boolean;
}

/**
 * Mobile top bar — logo (gauche), search + notifications + avatar (droite).
 * Tap sur l'avatar ouvre un BottomSheet avec préférences, admin, jumelage,
 * about, help, crédits, déconnexion. Le `MobileTabBar` en bas reste responsable
 * de la navigation primaire.
 */
export function TopNavMobile({ showSearch = true }: TopNavMobileProps) {
  const { t } = useTranslation("nav");
  const scrollProgress = useScrollOpacity(80);
  const bgOpacity = Math.min(0.9, scrollProgress * 1.2);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { initial } = getUserInfo();

  return (
    <>
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
            <TentacleLogo size="sm" variant="bare" />
          </Link>

          <div className="flex flex-shrink-0 items-center gap-2">
            {showSearch && <GlobalSearch />}
            <NotificationBell />
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label={t("profile")}
              aria-haspopup="menu"
              aria-expanded={sheetOpen}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white transition-transform duration-200 active:scale-95"
              style={AVATAR_RING_STYLE}
            >
              {initial}
            </button>
          </div>
        </div>
      </header>

      {sheetOpen && <MobileUserSheet onClose={() => setSheetOpen(false)} />}
    </>
  );
}
