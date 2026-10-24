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
 * Liquid Glass (macOS 26, mode natif, `windowGlass.ts`) : plus de capsule
 * unique — les barres de macOS 26 sont des GROUPES séparés qui flottent. Trois
 * surfaces de la primitive (`useLiquidGlassSurface`, lentille de page : la
 * bannière se courbe au biseau, lumière du bord, glyphes au ton du dessous) :
 * la marque et les onglets ; la recherche (`SearchLauncher`) ; les boutons et
 * le profil. Le groupe des onglets ÉPOUSE son contenu : « Plus » se calcule
 * alors sur la place libre de sa case (`usePriorityOverflow`, `slack`).
 * Hors mode natif, les enveloppes de groupe sont en `display: contents` et
 * la capsule d'avant est rendue telle quelle. `data-lg-toolbar` dit à l'effet
 * de bord de défilement de couvrir aussi la barre.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { useScrollScrim } from "./useScrollScrim";
import { useWindowGlass } from "../../desktop/windowGlass";
import { useLiquidGlassSurface } from "../../theme/glass";
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
import { OctaveEntryButton } from "../../music/octave/mode/OctaveEntry";

export function TopNav() {
  const offline = useOfflineMode();
  const glass = useWindowGlass();
  // La case qui s'étire, et le groupe de verre qui épouse les onglets — en
  // ÉTAT : leur arrivée relance la mesure des onglets (`usePriorityOverflow`).
  const [slotEl, setSlotEl] = useState<HTMLDivElement | null>(null);
  const [hugEl, setHugEl] = useState<HTMLElement | null>(null);
  const slack = useMemo(
    () => (glass && slotEl && hugEl ? { slot: slotEl, hug: hugEl } : undefined),
    [glass, slotEl, hugEl],
  );
  // Hors ligne, la session d'un PROFIL n'a ni catalogue local ni transferts
  // (rien n'est gardé pour lui) : aucun onglet, et pas de séparateur qui ne
  // sépare rien.
  const profileSession = useActiveProfile() !== null;
  // Sur la page de recherche, son champ EST la recherche (lot lg7, R13) : en
  // mode natif, la barre retire le sien — jamais deux champs à l'écran.
  const onSearchPage = useLocation().pathname === "/search";
  const showFieldLauncher = !offline && !(glass && onSearchPage);
  // Les puces d'état (hors ligne, économiseur) : en mode natif, DANS le groupe
  // d'actions (lot lg7, R16) — jamais un aplat qui flotte hors des groupes.
  const statusChips = (
    <>
      <ConnectivityChip />
      <DataSaverChip />
    </>
  );
  const tabs = offline ? (profileSession ? null : <OfflineNavLinks />) : <NavTabs slack={slack} />;

  // Les groupes (mode natif). Ailleurs : `contents`, ils n'existent pas pour
  // la mise en page.
  // Des PETITS verres : régime `control`, qui bascule avec le ton du dessous.
  const tabsGroup = useLiquidGlassSurface({ shape: "capsule", scale: "control", className: "lgc-group", fallbackClassName: "contents", ref: setHugEl });
  const actionsGroup = useLiquidGlassSurface({ shape: "capsule", scale: "control", className: "lgc-actions-group", fallbackClassName: "contents" });

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
        {!glass && (
          <>
            <div aria-hidden className="nav-capsule-glass" />
            <div ref={scrim.ref} aria-hidden className="nav-capsule-scrim" />
          </>
        )}

        <div ref={setSlotEl} className="relative flex min-w-0 flex-1 items-center gap-1">
          <div {...tabsGroup.props}>
            {tabsGroup.layers}
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
          {!glass && statusChips}
          {showFieldLauncher && <SearchLauncher variant="field" className="hidden w-[clamp(220px,21vw,360px)] lg:flex" />}
          <div {...actionsGroup.props}>
            {actionsGroup.layers}
            {glass && statusChips}
            {!offline && <SearchLauncher variant="icon" className="lg:hidden" />}
            {!offline && <OctaveEntryButton />}
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
