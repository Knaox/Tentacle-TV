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
 * Liquid Glass (macOS 26, `windowGlass.ts`) : la couche de verre de la capsule
 * est une surface de la primitive (`useLiquidGlassSurface`, lentille de page :
 * réfraction calculée pour la capsule exacte), et son assise s'arrête à 0,3 — c'est l'effet de bord
 * de défilement, DERRIÈRE elle, qui garde la lisibilité. `data-lg-toolbar`
 * dit à cet effet de couvrir aussi la barre. Le reflet suit le pointeur sur
 * la capsule (`useSpecularHighlight`, rAF seulement pendant qu'il bouge).
 */

import { useEffect } from "react";

import { useScrollScrim } from "./useScrollScrim";
import { useWindowGlass } from "../../desktop/windowGlass";
import { GlassSpecular, useLiquidGlassSurface, useSpecularHighlight } from "../../theme/glass";
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

export function TopNav() {
  const offline = useOfflineMode();
  // Hors ligne, la session d'un PROFIL n'a ni catalogue local ni transferts
  // (rien n'est gardé pour lui) : aucun onglet, et pas de séparateur qui ne
  // sépare rien.
  const profileSession = useActiveProfile() !== null;
  const tabs = offline ? (profileSession ? null : <OfflineNavLinks />) : <NavTabs />;

  // L'assise : nulle en haut de page (le verre seul, par-dessus la bannière),
  // puis jusqu'à 0,78 au défilement. Seule son OPACITÉ varie — la couche de
  // verre, qui porte le flou, n'est jamais repeinte (theme/chrome.css).
  const glass = useWindowGlass();
  const specular = useSpecularHighlight<HTMLDivElement>();
  // La couche qui porte le verre. Hors mode natif : `nav-capsule-glass`, le
  // dessin d'avant (theme/chrome.css), et rien d'autre.
  const capsuleGlass = useLiquidGlassSurface({
    level: "regular",
    shape: "capsule",
    backdrop: "page",
    className: "pointer-events-none absolute inset-0",
    fallbackClassName: "nav-capsule-glass",
  });
  const scrim = useScrollScrim<HTMLDivElement>({
    threshold: 140,
    opacityAt: (p) => Math.min(glass ? 0.3 : 0.78, p * 0.95),
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
        // Le reflet n'écoute le pointeur qu'en mode natif : ailleurs, aucun écouteur.
        ref={glass ? specular : undefined}
        data-hote-voile="topbar"
        className="lgc-capsule pointer-events-auto relative mx-auto mt-2 flex h-[52px] max-w-[1840px] items-center gap-1 rounded-[18px] px-1.5"
      >
        <div aria-hidden {...capsuleGlass.props}>{capsuleGlass.layers}</div>
        <div ref={scrim.ref} aria-hidden className="nav-capsule-scrim" />
        {glass && <GlassSpecular />}

        <div className="relative flex min-w-0 flex-1 items-center gap-1">
          <NavBrand />
          {tabs && (
            <>
              <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-line-subtle" />
              {tabs}
            </>
          )}
        </div>

        <div className="lgc-actions relative flex shrink-0 items-center gap-1.5 pl-2">
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
