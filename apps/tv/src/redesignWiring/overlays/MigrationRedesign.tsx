import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useDatabaseMigrationGate } from "@tentacle-tv/api-client";
import { decideMigrationScreen, type MigrationScreenDecision } from "@tentacle-tv/tv-core";
import type { DatabaseMigrationView } from "@tentacle-tv/shared";
import { MigrationOverlay } from "../../redesign/screens/overlays/MigrationOverlay";
import { useExitOnBack } from "../../platform/backScope";

/**
 * L'écran d'attente de la migration de la base, câblé sur les téléviseurs
 * (Apple TV, Android TV) : la vue de la porte commune (api-client
 * `useDatabaseMigrationGate` — capacité du serveur, relecture de
 * `/api/health`, retour sans toucher au compte), la décision de tv-core
 * (`decideMigrationScreen`), appliquées ici :
 *
 * - `MigrationCurtain` passe les écrans de l'application sans vue native
 *   (`display: none`) : rien n'y prend le focus, la pile revient intacte ;
 * - `MigrationRedesign` pose l'écran, sans cible ; sur Android TV, Retour
 *   quitte l'application (`useExitOnBack`), sur tvOS Menu n'est pas pris.
 */
export interface MigrationScreenState {
  view: DatabaseMigrationView | null;
  decision: MigrationScreenDecision;
}

export function useMigrationScreen(options: {
  /** Stable (module) : relue à chaque lecture de `/api/health`. */
  serverUrl: () => string | null;
  playbackShown: boolean;
  onResume: () => void;
}): MigrationScreenState {
  const view = useDatabaseMigrationGate({ backendUrl: options.serverUrl, onResume: options.onResume });
  return { view, decision: decideMigrationScreen({ migrating: view !== null, playbackShown: options.playbackShown }) };
}

/** Les écrans de l'application, montés pour React ; sans vue native pendant l'écran d'attente. */
export const MigrationCurtain = memo(function MigrationCurtain({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  return <View style={[styles.fill, hidden && styles.hidden]}>{children}</View>;
});

export function MigrationRedesign({ state }: { state: MigrationScreenState }) {
  return state.decision.show && state.view ? <MigrationSurface view={state.view} /> : null;
}

function MigrationSurface({ view }: { view: DatabaseMigrationView }) {
  useExitOnBack(true);
  return <MigrationOverlay view={view} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: "none" },
});
