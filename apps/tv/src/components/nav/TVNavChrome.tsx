import { useCallback, useRef } from "react";
import { useLibraries } from "@tentacle-tv/api-client";
import { navigationRef } from "../../navigation/navigationRef";
import { TVSideRail } from "./TVSideRail";
import { useContentFocusNode, useRailFocusSignal } from "../../context/TVNavContext";
import { useContentFocusCapture } from "../../hooks/useContentFocusCapture";

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

  // Après navigation, on déplace explicitement le focus vers le contenu —
  // sinon le rail, overlay persistant jamais démonté, garde le focus et l'écran
  // d'arrivée reste sans anneau. Longtemps réservé à tvOS ; c'était la raison
  // pour laquelle, sur Android, sélectionner une bibliothèque ne visait jamais
  // sa première affiche. Voir `useContentFocusCapture` pour l'asymétrie des deux
  // téléviseurs.
  const armContentFocus = useContentFocusCapture(contentFocusNode);

  const handleNavigate = useCallback((key: string) => {
    if (key === railKeyRef.current) return;
    armContentFocus(); // le focus ira au contenu dès que l'écran l'aura publié
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
  }, [libraries, armContentFocus]);

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
