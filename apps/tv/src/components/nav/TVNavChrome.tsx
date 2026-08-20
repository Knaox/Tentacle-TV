import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useLibraries } from "@tentacle-tv/api-client";
import { navigationRef } from "../../navigation/navigationRef";
import { TVSideRail } from "./TVSideRail";
import { useContentFocusNode, useRailFocusSignal } from "../../context/TVNavContext";

type NavStateLike =
  | { index: number; routes: Array<{ name: string; params?: object }> }
  | undefined;

/** Route active → clé du rail. `null` = écran plein écran (rail masqué).
 *  Calculée hors composant à partir de `navigationRef.getRootState()` (le chrome
 *  est sibling du Navigator → pas d'accès aux hooks de navigation). */
export function deriveRailKey(state: NavStateLike): string | null {
  const route = state?.routes?.[state.index];
  if (!route) return null;
  switch (route.name) {
    case "Home": return "Home";
    case "Search": return "Search";
    case "Watchlist": return "Watchlist";
    case "Favorites": return "Favorites";
    case "Settings": return "Settings";
    case "Library":
      return `Library_${(route.params as { libraryId?: string } | undefined)?.libraryId ?? ""}`;
    default: return null; // Player, MediaDetail, Trailer, PairCode, Disclaimer…
  }
}

/**
 * Chrome de navigation persistant : le rail latéral est monté UNE SEULE FOIS
 * (sibling du Navigator) au lieu d'être remonté par chaque écran via TVShell.
 * Supprime la latence de navigation (remontage rail + écran) sur boîtier réel.
 * Masqué automatiquement sur les écrans plein écran (lecture, fiche, jumelage).
 *
 * `railKey` est fourni par AppContent (onReady/onStateChange du
 * NavigationContainer) ; la navigation passe par `navigationRef`.
 */
export function TVNavChrome({ railKey }: { railKey: string | null }) {
  const railFocusSignal = useRailFocusSignal();
  const contentFocusNode = useContentFocusNode();
  const { data: libraries } = useLibraries();

  // railKey via ref : handleNavigate reste stable → RailRow mémoïsé pleinement
  // efficace (seules les 2 lignes dont `active` bascule re-rendent).
  const railKeyRef = useRef(railKey);
  railKeyRef.current = railKey;

  // Auto-collapse du rail à la sélection (tvOS) : après navigation, on déplace
  // explicitement le focus vers le contenu (sinon le rail, overlay persistant,
  // garde le focus → reste déployé). `contentFocusNode` est désormais un VRAI
  // Focusable publié par l'écran focus (useTVContentEntry). Cycle false→true :
  // le nœud a déjà hasTVPreferredFocus=true en prop, donc un simple true serait
  // un no-op → il faut forcer false PUIS true (workaround RN-tvos #849).
  // On grab le focus quand le NOUVEL écran a publié son `contentFocusNode` (et
  // pas sur un timer fixe : un pop-back vers l'Accueil publie plus tard qu'un
  // push). `pendingRef` est armé à la sélection d'un item du rail.
  const pendingRef = useRef(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!pendingRef.current || !contentFocusNode) return;
    pendingRef.current = false;
    const n = contentFocusNode as { setNativeProps?: (p: object) => void };
    let id2: ReturnType<typeof setTimeout>;
    const id1 = setTimeout(() => {
      n.setNativeProps?.({ hasTVPreferredFocus: false });
      id2 = setTimeout(() => n.setNativeProps?.({ hasTVPreferredFocus: true }), 50);
    }, 40);
    return () => { clearTimeout(id1); clearTimeout(id2); };
  }, [contentFocusNode]);

  const handleNavigate = useCallback((key: string) => {
    if (key === railKeyRef.current) return;
    pendingRef.current = true; // arme le focus contenu après navigation (tvOS)
    if (key === "Home") navigationRef.navigate("Home");
    else if (key === "Search") navigationRef.navigate("Search");
    else if (key === "Watchlist") navigationRef.navigate("Watchlist");
    else if (key === "Favorites") navigationRef.navigate("Favorites");
    else if (key === "Settings") navigationRef.navigate("Settings");
    else if (key.startsWith("Library_")) {
      const libId = key.replace("Library_", "");
      const lib = libraries?.find((l) => l.Id === libId);
      navigationRef.navigate("Library", { libraryId: libId, libraryName: lib?.Name ?? "" });
    }
  }, [libraries]);

  // Écran plein écran (lecture, fiche, jumelage) → pas de rail.
  if (!railKey) return null;

  return (
    <TVSideRail
      currentRoute={railKey}
      onNavigate={handleNavigate}
      grabFocusSignal={railFocusSignal}
    />
  );
}
