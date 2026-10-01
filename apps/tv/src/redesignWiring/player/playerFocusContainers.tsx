import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ComponentType } from "react";
import { StyleSheet, TVFocusGuideView, View, type FocusDestination } from "react-native";
import type { FocusGroupContainerProps } from "../../redesign/focus/focusBinding";
import { osdPlayPauseNodeRef, useSkipNode } from "../../components/player/focus/osdFocusBus";
import { AutoFocusGuide, TrapFocusGuide } from "../focus/focusGuides";
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
 *   décompte ; quand l'habillage est là, elle en ressort vers lecture/pause
 *   (BAS) et vers Retour (HAUT, GAUCHE) ;
 * - cartes, affiche, panneaux et message-outil le retiennent tant qu'ils sont
 *   ouverts ; les écrans qui couvrent la vidéo (ouverture, affiche de fin)
 *   aussi, croix Retour comprise, sans choisir par où l'on y entre
 *   (`ScreenTrap`) ;
 * - l'en-tête des épisodes renvoie toute montée vers la croix, la bande des
 *   saisons fait entrer par la saison AFFICHÉE ; la marge des pistes mène à
 *   leur croix depuis toute la colonne Audio.
 *
 * Chaque conteneur est un composant de MODULE (identité stable, exigée par le
 * port) ; ce qui varie se lit dans `PlayerFocusState`. La mémoire et le piège
 * sont ceux de tous les écrans (`focus/focusGuides`) ; seuls les ponts sont
 * propres au lecteur.
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

/**
 * La destination VIVANTE d'un écran : la première de ses clés dont le nœud est
 * monté, relue après chaque rendu et à chaque montage — jamais un nœud parti
 * (« Réessayer » disparaît quand l'ouverture repart).
 */
function useLiveDestination(store: FocusStore, keys: readonly string[]): FocusDestination[] {
  const [destinations, setDestinations] = useState<FocusDestination[]>([]);
  const aim = useCallback(() => {
    const key = keys.find((k) => store.node(k));
    const node = key ? (store.node(key) as FocusDestination | null) : null;
    setDestinations((prev) => (node ? (prev[0] === node ? prev : [node]) : prev.length ? [] : prev));
  }, [store, keys]);
  useEffect(() => store.subscribeNodes((key) => keys.includes(key) && aim()), [store, keys, aim]);
  // Relu après chaque rendu, voulu : la cible peut naître sans que le magasin le dise à temps.
  useEffect(aim);
  return destinations;
}

/**
 * Un PIÈGE D'ÉCRAN : le focus ne quitte pas un écran qui couvre la vidéo — ni
 * par une direction, ni vers l'habillage qu'il cache (infocalisable dessous :
 * mesuré, un saut y laissait l'app sans aucun focus). Sa destination est
 * l'entrée de l'écran, pour un focus qui y ARRIVE d'ailleurs ; pas
 * d'`autoFocus`, qui entrerait par la cible la plus en haut à gauche — la
 * croix Retour.
 */
function ScreenTrap({ destinations, style, pointerEvents, children }: FocusGroupContainerProps & { destinations: FocusDestination[] }) {
  return (
    <TVFocusGuideView
      destinations={destinations}
      focusable={destinations.length > 0 ? undefined : false}
      trapFocusUp
      trapFocusDown
      trapFocusLeft
      trapFocusRight
      style={style}
      pointerEvents={pointerEvents}
    >
      {children}
    </TVFocusGuideView>
  );
}

/** L'ouverture : « Réessayer » quand elle a échoué, sinon la croix — la seule action. */
const LOADING_ENTRIES = ["loading:retry", "loading:back"] as const;
function LoadingScreenGroup(props: FocusGroupContainerProps) {
  const { store } = usePlayerFocusState();
  return <ScreenTrap {...props} destinations={useLiveDestination(store, LOADING_ENTRIES)} />;
}

/** L'affiche de fin : « Lire maintenant » ; la croix s'atteint par HAUT. */
const END_ENTRIES = ["end:play"] as const;
function EndScreenGroup(props: FocusGroupContainerProps) {
  const { store } = usePlayerFocusState();
  return <ScreenTrap {...props} destinations={useLiveDestination(store, END_ENTRIES)} />;
}

/**
 * Un PONT : un guide qui renvoie le focus vers ses destinations — et qui, sans
 * destination, n'est plus rien. Il faut le dire : react-native-tvos marque
 * sélectionnable tout guide dont `destinations` est un tableau, même vide ;
 * le guide retombé en simple vue devient alors FOCALISABLE (mesuré : « haut »
 * depuis les commandes posait le focus sur la frise elle-même, invisible).
 */
function BridgeGuide({ destinations, style, pointerEvents, children }: FocusGroupContainerProps & { destinations: FocusDestination[] }) {
  return (
    <TVFocusGuideView
      destinations={destinations}
      focusable={destinations.length > 0 ? undefined : false}
      style={style}
      pointerEvents={pointerEvents}
    >
      {children}
    </TVFocusGuideView>
  );
}

/**
 * La frise : le pont entre les commandes et ce qui est au-dessus d'elles —
 * rien d'aligné, donc rien d'atteignable sans lui. Il a un SENS, lu sur le
 * focus : depuis les commandes, il monte vers la pilule de saut, ou vers
 * Retour s'il n'y en a pas ; depuis Retour, il redescend vers lecture/pause.
 * (Un guide ne sait pas d'où l'on vient : un pont vers Retour posé en
 * permanence y renverrait aussi la descente, et Retour deviendrait un piège.)
 */
function TimelineGroup(props: FocusGroupContainerProps) {
  const { store } = usePlayerFocusState();
  const subscribe = useCallback((notify: () => void) => store.subscribe(() => notify()), [store]);
  const focusedKey = useSyncExternalStore(subscribe, store.focusedKey, store.focusedKey);
  const skipNode = useSkipNode();
  const back = useStoreDestination(store, "player:back");
  const playPause = useStoreDestination(store, "player:playpause");
  const up = useMemo(() => (skipNode ? [skipNode] : back), [skipNode, back]);
  return <BridgeGuide {...props} destinations={focusedKey === "player:back" ? playPause : up} />;
}

/**
 * La pilule de saut et ses SORTIES, montées seulement tant que l'habillage est
 * là et que le focus est DANS l'îlot : posées en permanence, leurs zones
 * recouvriraient ce que le focus traverse ailleurs (la sortie du bas recouvre
 * la frise, et happait la remontée depuis les commandes).
 * - BAS mène à lecture/pause ;
 * - HAUT et GAUCHE mènent à Retour. Rien n'est au-dessus ni à gauche de la
 *   pilule relevée : sans elles, l'îlot était une impasse — les commandes
 *   montent vers la pilule, et Retour devenait inatteignable tant qu'elle
 *   était à l'écran. « Masquer » est à droite de « Passer » : GAUCHE depuis
 *   lui reste dans l'îlot, la sortie de gauche borde « Passer ».
 */
function IslandGroup({ style, pointerEvents, children }: FocusGroupContainerProps) {
  const { store, islandTrap, islandExit } = usePlayerFocusState();
  const playPause = islandExit ? osdPlayPauseNodeRef.current : null;
  const exit = useMemo(() => (playPause ? [playPause] : null), [playPause]);
  const back = useStoreDestination(store, "player:back");
  const toBack = islandExit && back.length > 0 ? back : null;
  return (
    <View pointerEvents="box-none">
      <TVFocusGuideView autoFocus trapFocusLeft={islandTrap} trapFocusRight={islandTrap} style={style} pointerEvents={pointerEvents}>
        {children}
      </TVFocusGuideView>
      {exit ? <TVFocusGuideView destinations={exit} style={styles.islandExit} /> : null}
      {toBack ? <TVFocusGuideView destinations={toBack} style={styles.islandUp} /> : null}
      {toBack ? <TVFocusGuideView destinations={toBack} style={styles.islandLeft} /> : null}
    </View>
  );
}

function EpisodesHeaderGroup(props: FocusGroupContainerProps) {
  const { store } = usePlayerFocusState();
  return <BridgeGuide {...props} destinations={useStoreDestination(store, "episodes:close")} />;
}

/** La marge des pistes : GAUCHE depuis toute la colonne Audio y entre et rejoint la croix. */
function TracksBackGroup(props: FocusGroupContainerProps) {
  const { store } = usePlayerFocusState();
  return <BridgeGuide {...props} destinations={useStoreDestination(store, "tracks:close")} />;
}

function SeasonsGroup(props: FocusGroupContainerProps) {
  const { store, activeSeasonIndex } = usePlayerFocusState();
  return <BridgeGuide {...props} destinations={useStoreDestination(store, `episodes:season:${activeSeasonIndex}`)} />;
}

/** Les groupes que le lecteur lie, et leur guide. */
export const PLAYER_GROUP_CONTAINERS: Readonly<Record<string, ComponentType<FocusGroupContainerProps>>> = {
  "player:osd": AutoFocusGuide,
  "player:timeline": TimelineGroup,
  "player:skip-island": IslandGroup,
  "upnext:actions": TrapFocusGuide,
  "loading:screen": LoadingScreenGroup,
  "end:screen": EndScreenGroup,
  "trouble:actions": TrapFocusGuide,
  "tracks:panel": TrapFocusGuide,
  "tracks:back": TracksBackGroup,
  "episodes:panel": TrapFocusGuide,
  "episodes:header": EpisodesHeaderGroup,
  "episodes:seasons": SeasonsGroup,
};

const styles = StyleSheet.create({
  islandExit: { position: "absolute", top: "100%", left: -80, right: 0, height: 140 },
  islandUp: { position: "absolute", bottom: "100%", left: 0, right: 0, height: 120 },
  islandLeft: { position: "absolute", right: "100%", top: 0, bottom: 0, width: 160 },
});
