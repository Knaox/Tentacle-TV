import { memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { TentacleSvg } from "../../components/ui/TentacleSvg";
import { countLogoClick } from "../../components/easterEggs/logoEggStore";
import { useOfflineMode } from "../../offline/useOfflineMode";
import { ConnectivityChip } from "../../offline/ConnectivityChip";
import { useConnectivity } from "../../offline/useConnectivity";
import { HeaderContentMenu } from "./HeaderContentMenu";
import { MirrorNotificationBell } from "./MirrorNotificationBell";

/** De combien l'en-tête remonte au repli. */
const COLLAPSE_SHIFT = 8;

/**
 * L'en-tête persistant de l'app (`PersistentHeader`) : verre flottant sur toute
 * la largeur, le contenu défile dessous. À gauche le logo (28) et « Tentacle
 * TV » (22, graisse 800) ; à droite, espacés de 22, « Mes contenus », la
 * recherche et la cloche. Un filet violet à 12 % le souligne.
 * Hors ligne, la pastille de connexion prend la place du titre et les actions
 * serveur disparaissent.
 */
export const MirrorHeader = memo(function MirrorHeader({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation("nav");
  const navigate = useNavigate();
  const localNav = useOfflineMode();
  const { state } = useConnectivity();
  const offline = state === "offline-auto" || state === "offline-manual";

  return (
    <header
      className="mirror-chrome-motion fixed inset-x-0 top-0 z-40"
      style={{ transform: collapsed ? `translateY(-${COLLAPSE_SHIFT}px)` : "none" }}
    >
      <div className="mirror-glass-modal">
        <div
          className="flex items-center justify-between px-4"
          style={{
            paddingTop: "calc(max(env(safe-area-inset-top, 0px), 24px) + 4px)",
            paddingBottom: 12,
            paddingLeft: "max(16px, env(safe-area-inset-left, 0px))",
            paddingRight: "max(16px, env(safe-area-inset-right, 0px))",
          }}
        >
          <Link to="/" onClick={countLogoClick} className="flex items-center gap-2" aria-label="Tentacle TV">
            <TentacleSvg size={28} />
            {offline ? (
              <ConnectivityChip />
            ) : (
              <span className="text-[22px] font-extrabold leading-7 text-content-primary">Tentacle TV</span>
            )}
          </Link>

          {!localNav && (
            <div className="flex items-center gap-[22px]">
              <HeaderContentMenu />
              <button
                type="button"
                onClick={() => navigate("/search")}
                aria-label={t("search")}
                className="mirror-press -m-3 flex p-3 text-content-primary"
              >
                <Search size={21} strokeWidth={2} aria-hidden />
              </button>
              <MirrorNotificationBell />
            </div>
          )}
        </div>
        <div aria-hidden className="h-px w-full" style={{ background: "rgba(var(--brand-rgb), 0.12)" }} />
      </div>
    </header>
  );
});
