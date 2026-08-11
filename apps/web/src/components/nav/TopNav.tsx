import { Link } from "react-router-dom";
import { TopNavLinks } from "./TopNavLinks";
import { useScrollScrim } from "./useScrollScrim";
import { GlobalSearch } from "../GlobalSearch";
import { NotificationBell } from "../NotificationBell";
import { UserAvatarMenu } from "../UserAvatarMenu";
import { TentacleLogo } from "../ui/TentacleLogo";
import { compterClicLogo } from "../easterEggs/logoEggStore";
import { BrowseButton } from "./BrowseButton";
import { WatchTogetherButton } from "../../watchTogether/WatchTogetherButton";
import { ConnectivityChip } from "../../offline/ConnectivityChip";
import { DataSaverChip } from "../../offline/DataSaverChip";
import { DownloadsNavButton } from "../../downloads/DownloadsNavButton";
import { OfflineNavLinks } from "../../offline/OfflineNavLinks";
import { useOfflineMode } from "../../offline/useOfflineMode";

interface TopNavProps {
  showSearch?: boolean;
}

/**
 * Desktop horizontal top navigation — replaces the legacy 62px sidebar.
 * Behaviour: fully transparent at scroll=0, fades to opaque black with a subtle
 * bottom border once content scrolls underneath. Mirrors the Netflix pattern.
 */
export function TopNav({ showSearch = true }: TopNavProps) {
  // Hors ligne (desktop) : la navigation serveur n'est PAS rendue — restent
  // le logo, la pastille d'état, les téléchargements et le menu utilisateur.
  const offline = useOfflineMode();

  // Assise 0.28 dès le haut de page : elle garantit la lisibilité de la barre
  // par-dessus n'importe quelle bannière. Montée jusqu'à 0.92 au défilement,
  // pour rester cohérent avec le motif « transparent en haut, opaque sur les
  // rangées ». L'opacité est écrite sur la SEULE couche d'assise, jamais sur la
  // barre : celle-ci porte un `backdrop-filter` et la repeindre à chaque image
  // de défilement redemandait une passe de flou pleine largeur.
  const scrim = useScrollScrim<HTMLDivElement>({
    threshold: 120,
    opacityAt: (p) => Math.min(0.92, 0.28 + p * 0.85),
    crossAt: 0.95,
  });

  return (
    <header
      data-host-chrome="topbar"
      className="fixed inset-x-0 z-40 h-[68px]"
      style={{
        // Sous le bandeau d'hôte, quand il y en a un : une position fixe se
        // repère sur la FENÊTRE, le remplissage du `body` ne la décale pas.
        // Vaut `0px` partout ailleurs (`index.css`).
        top: "var(--hote-bandeau)",
        // Transition sur la SEULE bordure, qui apparaît sur un seuil : son
        // fondu est réel. Elle suit le token `--border-subtle` — un blanc en
        // dur dessinait un liseré incongru sur fond clair.
        transition: "border-color 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        borderBottom: scrim.crossed ? "1px solid var(--border-subtle)" : "1px solid transparent",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      {/* Assise colorée. `--surface-0` et non un noir figé : la barre doit se
          fondre dans le fond de page, qui devient nacré en thème clair. */}
      <div ref={scrim.ref} aria-hidden className="nav-scrim" />

      <div className="nav-content flex h-full items-center gap-6 px-4 md:px-12">
        <Link
          to="/"
          // Le compteur ne PRÉVIENT pas la navigation : le logo doit continuer
          // de ramener à l'accueil comme tout le monde s'y attend. Les clics
          // suivants tombent sur l'accueil, où revenir à l'accueil n'est rien.
          onClick={compterClicLogo}
          className="flex flex-shrink-0 items-center gap-2.5 transition-opacity duration-200 hover:opacity-80"
          aria-label="Tentacle TV — Accueil"
        >
          <TentacleLogo size="md" variant="bare" />
          <span
            className="hidden text-base font-bold tracking-tight text-content-primary sm:inline"
            style={{ letterSpacing: "-0.02em" }}
          >
            Tentacle TV
          </span>
        </Link>

        {/* Browse menu (libraries pin manager) */}
        {!offline && <BrowseButton />}

        {/* Primary nav (horizontal) — only shows pinned items.
            Hors ligne, les bibliothèques du serveur sont injoignables : la
            barre reste sinon VIDE, et depuis « Gérer les téléchargements » plus
            rien ne ramenait au catalogue. */}
        <div className="min-w-0 flex-1">
          {offline ? <OfflineNavLinks /> : <TopNavLinks />}
        </div>

        {/* Right cluster: offline chip (desktop) + search + watch-together + notif + avatar */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <ConnectivityChip />
          <DataSaverChip />
          <DownloadsNavButton />
          {showSearch && !offline && <GlobalSearch />}
          {!offline && <WatchTogetherButton />}
          {!offline && <NotificationBell />}
          <UserAvatarMenu />
        </div>
      </div>
    </header>
  );
}
