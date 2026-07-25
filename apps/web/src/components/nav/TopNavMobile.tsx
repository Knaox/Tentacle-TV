import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useScrollScrim } from "./useScrollScrim";
import { GlobalSearch } from "../GlobalSearch";
import { NotificationBell } from "../NotificationBell";
import { TentacleLogo } from "../ui/TentacleLogo";
import { MobileUserSheet } from "../MobileUserSheet";
import { AVATAR_RING_STYLE, getUserInfo } from "../userMenu/menuItems";
import { WatchTogetherButton } from "../../watchTogether/WatchTogetherButton";

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
  // Même partage que `TopNav` : l'assise vit sur une couche dédiée dont seule
  // l'opacité varie, la barre elle-même ne change plus. Le seuil sert ici à
  // basculer le flou, qui n'a rien à flouter tant que la barre est claire.
  const scrim = useScrollScrim<HTMLDivElement>({
    threshold: 80,
    opacityAt: (p) => Math.min(0.9, p * 1.2),
    crossAt: 0.3,
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const { initial } = getUserInfo();

  return (
    <>
      <header
        data-host-chrome="topbar-mobile"
        className="fixed inset-x-0 top-0 z-40 h-[56px]"
        style={{
          backdropFilter: scrim.crossed ? "blur(10px)" : "none",
          WebkitBackdropFilter: scrim.crossed ? "blur(10px)" : "none",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
        }}
      >
        <div ref={scrim.ref} aria-hidden className="nav-scrim" />

        <div className="nav-content flex h-full items-center justify-between px-3">
          <Link
            to="/"
            className="flex flex-shrink-0 items-center"
            aria-label="Tentacle TV — Accueil"
          >
            <TentacleLogo size="sm" variant="bare" />
          </Link>

          <div className="flex flex-shrink-0 items-center gap-2">
            {showSearch && <GlobalSearch />}
            <WatchTogetherButton />
            <NotificationBell />
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label={t("profile")}
              aria-haspopup="menu"
              aria-expanded={sheetOpen}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-cta-brand-fg transition-transform duration-200 active:scale-95"
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
