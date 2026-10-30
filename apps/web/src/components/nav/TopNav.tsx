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
 * local, l'état de la connexion et le profil — pour la session d'un profil de
 * la famille, l'état de la connexion et le profil seulement.
 *
 * Zone de 68 px, comme avant : les pages gardent leur marge haute, et celles
 * qui remontent leur bannière dessous (`-mt-[68px]`) continuent de le faire.
 * Le bandeau d'hôte de macOS (feux tricolores) reste au-dessus.
 *
 * Liquid Glass (macOS 26, mode natif, `windowGlass.ts`) : le verre change le
 * MATÉRIAU, jamais les DIMENSIONS (Damien, 26/10) — même capsule, mêmes places
 * qu'hors verre ; seule sa peau devient celle de la maquette
 * (`windowGlassNav.css`). `data-lg-toolbar` dit à l'effet de bord de
 * défilement de couvrir aussi la barre.
 */

import { useEffect } from "react";

import { useScrollScrim } from "./useScrollScrim";
import { useWindowGlass } from "../../desktop/windowGlass";
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
import { useActiveProfile } from "../../auth/profileSession";
import { OctaveModeSwitch } from "../../music/octave/mode/OctaveModeSwitch";

export function TopNav() {
  const offline = useOfflineMode();
  const glass = useWindowGlass();
  // Hors ligne, la session d'un PROFIL n'a ni catalogue local ni transferts
  // (rien n'est gardé pour lui) : aucun onglet, et pas de séparateur qui ne
  // sépare rien.
  const profileSession = useActiveProfile() !== null;
  const showFieldLauncher = !offline;
  // Liquid Glass (26/10, Damien : « le verre change le MATÉRIAU, jamais les
  // DIMENSIONS ») : la barre garde EXACTEMENT la mise en page d'avant — même
  // capsule, mêmes places ; en natif, seule sa peau change (`windowGlassNav.css`).
  const statusChips = (
    <>
      <ConnectivityChip />
      <DataSaverChip />
    </>
  );
  const tabs = offline ? (profileSession ? null : <OfflineNavLinks />) : <NavTabs />;

  // L'assise d'avant : nulle en haut de page (le verre seul, par-dessus la
  // bannière), puis jusqu'à 0,78 au défilement. Seule son OPACITÉ varie — la
  // couche de verre, qui porte le flou, n'est jamais repeinte (theme/chrome.css).
  const scrim = useScrollScrim<HTMLDivElement>({
    threshold: 140,
    opacityAt: (p) => Math.min(0.78, p * 0.95),
  });

  useEffect(() => {
    if (!glass) return;
    const root = document.documentElement;
    root.dataset["lgToolbar"] = "nav";
    return () => {
      delete root.dataset["lgToolbar"];
    };
  }, [glass]);

  return (
    <header
      // La zone est transparente aux clics : seule la capsule en prend.
      // `data-top-nav` : la mini-carte d'aperçu ne monte jamais sous la barre.
      data-top-nav
      className="pointer-events-none fixed inset-x-0 z-40 h-[68px] px-3 md:px-4 lg:px-6"
      style={{ top: "var(--hote-bandeau)", paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Le voile des greffons (`hostChromeVeil`) vise la CAPSULE, pas
          l'en-tête : son `pointer-events: none` posé sur l'en-tête ne
          l'atteindrait pas, puisqu'elle rétablit les clics pour elle-même. */}
      <div
        data-hote-voile="topbar"
        className="lgc-capsule pointer-events-auto relative mx-auto mt-2 flex h-[52px] max-w-[1840px] items-center gap-1 rounded-[18px] px-1.5"
      >
        <div aria-hidden className="nav-capsule-glass" />
        <div ref={scrim.ref} aria-hidden className="nav-capsule-scrim" />

        <div className="relative flex min-w-0 flex-1 items-center gap-1">
          <div className="contents">
            <NavBrand />
            {tabs && (
              <>
                <span aria-hidden className="lgc-separator mx-1 h-6 w-px shrink-0 bg-line-subtle" />
                {tabs}
              </>
            )}
          </div>
        </div>

        <div className="lgc-actions relative flex shrink-0 items-center gap-1.5 pl-2">
          {statusChips}
          {showFieldLauncher && <SearchLauncher variant="field" className="hidden w-[clamp(220px,21vw,360px)] lg:flex" />}
          <div className="contents">
            {!offline && <SearchLauncher variant="icon" className="lg:hidden" />}
            {/* Hors ligne aussi (lot « fl ») : la bascule décide seule (`octaveSwitchShown`). */}
            <OctaveModeSwitch placement="tentacle" />
            <DownloadsNavButton />
            {!offline && <WatchTogetherButton />}
            {!offline && <NotificationBell />}
            <UserAvatarMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
