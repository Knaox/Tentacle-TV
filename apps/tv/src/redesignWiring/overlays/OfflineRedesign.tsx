import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { OfflineOverlay } from "../../redesign/screens/overlays/OfflineOverlay";
import { useOfflineLogout } from "../../hooks/useOfflineLogout";
import { useFocusStore } from "../focus/focusStore";
import { TrapFocusGuide } from "../focus/focusGuides";
import { useKeepFocusWithin } from "../focus/useKeepFocusWithin";

const KEYS = ["offline:retry", "offline:unpair"] as const;

/**
 * Le voile hors ligne de la refonte (Apple TV), monté par `OfflineBanner`
 * quand `useServerReachable` tombe.
 *
 * Le focus reste DANS le panneau (piège du groupe `offline:panel`, et
 * reprise de ce qu'un écran d'en dessous réclamerait). Menu n'y est jamais
 * intercepté : monté hors des écrans, le panneau n'est sur le chemin d'aucun,
 * l'appui remonte jusqu'à l'application et renvoie à l'accueil de tvOS —
 * la règle qu'App Review vérifie.
 *
 * « Déjumeler cet appareil » (double appui, tenu par la vue) passe par
 * `useOfflineLogout`, la sortie hors ligne des deux téléviseurs : rien n'y
 * attend le réseau, et elle passe même pendant une lecture.
 */
export function OfflineRedesign({ visible, onRetry }: {
  visible: boolean;
  onRetry: () => void | Promise<unknown>;
}) {
  return visible ? <OfflineSurface onRetry={onRetry} /> : null;
}

function OfflineSurface({ onRetry }: { onRetry: () => void | Promise<unknown> }) {
  const { storage } = useTentacleConfig();
  const unpair = useOfflineLogout();
  const [retrying, setRetrying] = useState(false);

  const store = useFocusStore();
  // Le piège naît avec le panneau : un groupe se lie dès son premier rendu.
  useState(() => store.bind("offline:panel", { container: TrapFocusGuide }));
  useKeepFocusWithin(store, KEYS, "offline:retry");

  const retry = useCallback(() => {
    setRetrying(true);
    void Promise.resolve(onRetry()).finally(() => setRetrying(false));
  }, [onRetry]);

  return (
    <View pointerEvents="box-none" style={styles.cover}>
      <FocusBindingProvider bind={store.binder}>
        <OfflineOverlay
          serverUrl={storage.getItem("tentacle_server_url") ?? undefined}
          retrying={retrying}
          onRetry={retry}
          onUnpair={unpair}
        />
      </FocusBindingProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  // Par-dessus TOUT ce que l'app monte à côté des écrans : le rail actuel
  // (`zIndex` 100) comme les bandeaux montés après lui.
  cover: { ...StyleSheet.absoluteFillObject, zIndex: 999 },
});
