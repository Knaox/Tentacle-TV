/**
 * La barre de navigation desktop — une CAPSULE de verre qui flotte au-dessus
 * du contenu : les bannières passent dessous, la page défile dessous, et la
 * barre reste lisible sur n'importe quelle image (verre sombre, puis assise
 * qui s'opacifie au défilement).
 *
 * De gauche à droite : la marque ; les destinations, icône et libellé,
 * bibliothèques comprises — plus de menu à ouvrir pour atteindre « Films » —,
 * avec « Plus » pour le reste ; la RECHERCHE, au cœur de la barre (⌘K) ;
 * puis ce qui se passe maintenant : téléchargements, Watch Together,
 * notifications, profil.
 *
 * Hors ligne (bureau), la navigation serveur s'efface : restent le catalogue
 * local, l'état de la connexion et le profil.
 *
 * Zone de 68 px, comme avant : les pages gardent leur marge haute, et celles
 * qui remontent leur bannière dessous (`-mt-[68px]`) continuent de le faire.
 * Le bandeau d'hôte de macOS (feux tricolores) reste au-dessus.
 */

import { useScrollScrim } from "./useScrollScrim";
import { NavBrand } from "./NavBrand";
import { NavTabs } from "./NavTabs";
import { SearchLauncher } from "../search/SearchLauncher";
import { NotificationBell } from "../NotificationBell";
import { UserAvatarMenu } from "../UserAvatarMenu";
import { WatchTogetherButton } from "../../watchTogether/WatchTogetherButton";
import { ConnectivityChip } from "../../offline/ConnectivityChip";
import { DataSaverChip } from "../../offline/DataSaverChip";
import { DownloadsNavButton } from "../../downloads/DownloadsNavButton";
import { OfflineNavLinks } from "../../offline/OfflineNavLinks";
import { useOfflineMode } from "../../offline/useOfflineMode";

export function TopNav() {
  const offline = useOfflineMode();

  // L'assise : nulle en haut de page (le verre seul, par-dessus la bannière),
  // puis jusqu'à 0,78 au défilement. Seule son OPACITÉ varie — la couche de
  // verre, qui porte le flou, n'est jamais repeinte (theme/chrome.css).
  const scrim = useScrollScrim<HTMLDivElement>({
    threshold: 140,
    opacityAt: (p) => Math.min(0.78, p * 0.95),
  });

  return (
    <header
      // La zone est transparente aux clics : seule la capsule en prend.
      className="pointer-events-none fixed inset-x-0 z-40 h-[68px] px-3 md:px-4 lg:px-6"
      style={{ top: "var(--hote-bandeau)", paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Le voile des greffons (`hostChromeVeil`) vise la CAPSULE, pas
          l'en-tête : son `pointer-events: none` posé sur l'en-tête ne
          l'atteindrait pas, puisqu'elle rétablit les clics pour elle-même. */}
      <div
        data-hote-voile="topbar"
        className="pointer-events-auto relative mx-auto mt-2 flex h-[52px] max-w-[1840px] items-center gap-1 rounded-[18px] px-1.5"
      >
        <div aria-hidden className="nav-capsule-glass" />
        <div ref={scrim.ref} aria-hidden className="nav-capsule-scrim" />

        <div className="relative flex min-w-0 flex-1 items-center gap-1">
          <NavBrand />
          <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-line-subtle" />
          {offline ? <OfflineNavLinks /> : <NavTabs />}
        </div>

        <div className="relative flex shrink-0 items-center gap-1.5 pl-2">
          <ConnectivityChip />
          <DataSaverChip />
          {!offline && (
            <>
              <SearchLauncher variant="field" className="hidden w-[clamp(220px,21vw,360px)] lg:flex" />
              <SearchLauncher variant="icon" className="lg:hidden" />
            </>
          )}
          <DownloadsNavButton />
          {!offline && <WatchTogetherButton />}
          {!offline && <NotificationBell />}
          <UserAvatarMenu />
        </div>
      </div>
    </header>
  );
}
