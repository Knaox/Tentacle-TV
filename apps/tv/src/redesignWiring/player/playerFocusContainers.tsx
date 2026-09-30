import { createContext, useContext, useEffect, useMemo, useState, type ComponentType } from "react";
import { StyleSheet, TVFocusGuideView, View, type FocusDestination } from "react-native";
import type { FocusGroupContainerProps } from "../../redesign/focus/focusBinding";
import { osdPlayPauseNodeRef, useSkipNode } from "../../components/player/focus/osdFocusBus";
import type { FocusStore } from "../focus/focusStore";

/**
 * Les GUIDES de focus du lecteur Apple TV, posés sur les groupes que ses vues
 * nomment (`FocusGroup`). Ce sont ceux de l'habillage actuel, un par un, tous
 * payés par une régression (cf. `TVPlayerOverlay`, `TVPlaybackOverlay`,
 * `TVPlayerEpisodePanel`, `TVSeasonPills`) :
 * - l'habillage MÉMORISE son dernier bouton (`autoFocus`) : c'est là que le
 *   focus revient de la pilule, et là qu'il se pose quand l'habillage revient ;
 * - la frise est le pont MONTANT vers la pilule de saut ;
 * - la pilule retient le focus entre « Passer » et « Masquer » pendant un
 *   décompte, et en ressort vers lecture/pause quand l'habillage est là ;
 * - cartes, affiche et panneaux le retiennent tant qu'ils sont ouverts ;
 * - l'en-tête des épisodes renvoie toute montée vers Fermer, la bande des
 *   saisons fait entrer par la saison AFFICHÉE.
 *
 * Chaque conteneur est un composant de MODULE (identité stable, exigée par le
 * port) ; ce qui varie se lit dans `PlayerFocusState`.
 */

export interface PlayerFocusState {
  store: FocusStore;
  /** La pilule retient le focus à gauche et à droite (décompte, habillage caché). */
  islandTrap: boolean;
  /** La sortie de la pilule vers lecture/pause : habillage visible, focus dans l'îlot. */
  islandExit: boolean;
  /** Le rang de la saison affichée dans la bande du panneau des épisodes. */
  activeSeasonIndex: number;
}

const PlayerFocusContext = createContext<PlayerFocusState | null>(null);
export const PlayerFocusStateProvider = PlayerFocusContext.Provider;

function usePlayerFocusState(): PlayerFocusState {
  const state = useContext(PlayerFocusContext);
  if (!state) throw new Error("PlayerFocusStateProvider manquant autour de l'habillage du lecteur");
  return state;
}

/**
 * Une destination qui suit un nœud du magasin, relu après CHAQUE rendu : la
 * cible naît après le guide (les saisons arrivent du serveur, une pastille se
 * remonte), et le magasin ne prévient pas d'un montage. L'état ne change que
 * si le nœud a changé — pas de boucle.
 */
function useStoreDestination(store: FocusStore, key: string): FocusDestination[] {
  const [destinations, setDestinations] = useState<FocusDestination[]>([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- relu après chaque rendu, voulu (cf. ci-dessus)
  useEffect(() => {
    const node = store.node(key) as FocusDestination | null;
    if (node && destinations[0] !== node) setDestinations([node]);
  });
  return destinations;
}

function OsdGroup({ style, pointerEvents, children }: FocusGroupContainerProps) {
  return <TVFocusGuideView autoFocus style={style} pointerEvents={pointerEvents}>{children}</TVFocusGuideView>;
}

function TimelineGroup({ style, pointerEvents, children }: FocusGroupContainerProps) {
  // Sans pilule, le guide est inerte : une liste vide ne redirige rien.
  const skipNode = useSkipNode();
  const destinations = useMemo(() => (skipNode ? [skipNode] : []), [skipNode]);
  return <TVFocusGuideView destinations={destinations} style={style} pointerEvents={pointerEvents}>{children}</TVFocusGuideView>;
}

function IslandGroup({ style, pointerEvents, children }: FocusGroupContainerProps) {
  const { islandTrap, islandExit } = usePlayerFocusState();
  const playPause = islandExit ? osdPlayPauseNodeRef.current : null;
  const exit = useMemo(() => (playPause ? [playPause] : null), [playPause]);
  return (
    <View pointerEvents="box-none">
      <TVFocusGuideView autoFocus trapFocusLeft={islandTrap} trapFocusRight={islandTrap} style={style} pointerEvents={pointerEvents}>
        {children}
      </TVFocusGuideView>
      {/* La SORTIE vers lecture/pause, montée seulement tant que le focus est
          DANS l'îlot : posée en permanence, sa zone recouvre la frise — ce que
          le focus traverse en remontant des commandes —, et elle happait la
          remontée. */}
      {exit ? <TVFocusGuideView destinations={exit} style={styles.islandExit} /> : null}
    </View>
  );
}

function TrapGroup({ style, pointerEvents, children }: FocusGroupContainerProps) {
  return (
    <TVFocusGuideView autoFocus trapFocusUp trapFocusDown trapFocusLeft trapFocusRight style={style} pointerEvents={pointerEvents}>
      {children}
    </TVFocusGuideView>
  );
}

function EpisodesHeaderGroup({ style, pointerEvents, children }: FocusGroupContainerProps) {
  const { store } = usePlayerFocusState();
  const destinations = useStoreDestination(store, "episodes:close");
  return <TVFocusGuideView destinations={destinations} style={style} pointerEvents={pointerEvents}>{children}</TVFocusGuideView>;
}

function SeasonsGroup({ style, pointerEvents, children }: FocusGroupContainerProps) {
  const { store, activeSeasonIndex } = usePlayerFocusState();
  const destinations = useStoreDestination(store, `episodes:season:${activeSeasonIndex}`);
  return <TVFocusGuideView destinations={destinations} style={style} pointerEvents={pointerEvents}>{children}</TVFocusGuideView>;
}

/** Les groupes que le lecteur lie, et leur guide. */
export const PLAYER_GROUP_CONTAINERS: Readonly<Record<string, ComponentType<FocusGroupContainerProps>>> = {
  "player:osd": OsdGroup,
  "player:timeline": TimelineGroup,
  "player:skip-island": IslandGroup,
  "upnext:actions": TrapGroup,
  "end:actions": TrapGroup,
  "tracks:panel": TrapGroup,
  "episodes:panel": TrapGroup,
  "episodes:header": EpisodesHeaderGroup,
  "episodes:seasons": SeasonsGroup,
};

const styles = StyleSheet.create({
  islandExit: { position: "absolute", top: "100%", left: -80, right: 0, height: 140 },
});
