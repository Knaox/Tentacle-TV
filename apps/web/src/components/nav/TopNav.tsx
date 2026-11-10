/**
 * La barre de navigation desktop — des GROUPES de verre qui flottent au-dessus du contenu
 * (refonte de nov. 2026) : les bannières passent dessous, la page défile dessous, et chaque
 * groupe reste lisible sur n'importe quelle image (verre, puis assise qui s'opacifie au
 * défilement — `NavGroup`).
 *
 * De gauche à droite : la NAVIGATION — la marque, les destinations, bibliothèques comprises,
 * et « Plus » pour ce qui ne tient pas (la largeur est MESURÉE, `usePriorityOverflow` : la
 * barre ne déborde jamais, même avec vingt bibliothèques) ; la RECHERCHE (⌘K) ; les ACTIONS —
 * état de la connexion, Octave, téléchargements, Watch Together, notifications ; le COMPTE.
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
 * MATÉRIAU, jamais les DIMENSIONS (Damien, 26/10) — mêmes groupes, mêmes places
 * qu'hors verre ; seule leur peau devient celle de la maquette
 * (`windowGlassNav.css`). `data-lg-toolbar` dit à l'effet de bord de
 * défilement de couvrir aussi la barre.
 */

import { useEffect, useMemo, useState } from "react";

import { useWindowGlass } from "../../desktop/windowGlass";
import { NavBrand } from "./NavBrand";
import { NavGroup } from "./NavGroup";
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
  const statusChips = (
    <>
      <ConnectivityChip />
      <DataSaverChip />
    </>
  );
  // Le groupe de navigation ÉPOUSE son contenu : la place libre se lit sur la case qui
  // s'étire autour de lui (`OverflowSlack`). Des éléments tenus en état, pas des refs —
  // leur arrivée relance la mesure.
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [hug, setHug] = useState<HTMLDivElement | null>(null);
  const slack = useMemo(() => (slot && hug ? { slot, hug } : undefined), [slot, hug]);
  const tabs = offline ? (profileSession ? null : <OfflineNavLinks />) : <NavTabs slack={slack} />;

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
      // La zone est transparente aux clics : seuls les groupes en prennent.
      // `data-top-nav` : la mini-carte d'aperçu ne monte jamais sous la barre.
      data-top-nav
      className="pointer-events-none fixed inset-x-0 z-40 h-[68px] px-3 md:px-4 lg:px-6"
      style={{ top: "var(--hote-bandeau)", paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="mx-auto mt-[11px] flex h-[46px] max-w-[1840px] items-center gap-2">
        {/* La case qui s'étire : le groupe de navigation y prend sa largeur, jamais plus. */}
        <div ref={setSlot} className="flex min-w-0 flex-1 items-center">
          <NavGroup ref={setHug} className="min-w-0 max-w-full" contentClassName="gap-0.5 pl-1.5 pr-1">
            <NavBrand />
            {tabs && (
              <>
                <span aria-hidden className="lgc-separator mx-1 h-6 w-px shrink-0 bg-line-subtle" />
                {tabs}
              </>
            )}
          </NavGroup>
        </div>

        {!offline && <SearchLauncher variant="field" className="hidden w-[clamp(200px,20vw,280px)] shrink-0 lg:block" />}

        <NavGroup className="lgc-actions shrink-0" contentClassName="gap-0.5 px-1">
          {statusChips}
          {!offline && <SearchLauncher variant="icon" className="lg:hidden" />}
          {/* Hors ligne aussi (lot « fl ») : la bascule décide seule (`octaveSwitchShown`). */}
          <OctaveModeSwitch placement="tentacle" />
          <DownloadsNavButton />
          {!offline && <WatchTogetherButton />}
          {!offline && <NotificationBell />}
        </NavGroup>

        <UserAvatarMenu />
      </div>
    </header>
  );
}
