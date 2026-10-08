import type { ReactNode } from "react";
import { Platform } from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import { useDatabaseMigrationGate } from "@tentacle-tv/api-client";
import { probeNow } from "@/offline/connectivityStore";
import { DatabaseMigrationScreen } from "./DatabaseMigrationScreen";

/**
 * La SEULE porte de l'écran d'attente de la migration de la base sur le
 * mobile : montée une fois, à la racine, dès que le serveur est connu. La
 * décision est celle de tous les clients (`useDatabaseMigrationGate`) ; au
 * retour, la connectivité se resonde aussi tout de suite.
 *
 * Sur iOS, le lecteur est une modale NATIVE au-dessus de la racine : l'écran
 * passe par une `FullWindowOverlay`, posée seulement quand il est là (le patron
 * de `SessionMessageHost`). Sur Android, une vue après la pile suffit.
 */
export function DatabaseMigrationHost({ serverUrl }: { serverUrl: string | null }) {
  const view = useDatabaseMigrationGate({ backendUrl: serverUrl, onResume: resume });
  if (!view) return null;
  return <AboveEverything><DatabaseMigrationScreen view={view} /></AboveEverything>;
}

const resume = () => void probeNow(true);

function AboveEverything({ children }: { children: ReactNode }) {
  return Platform.OS === "ios" ? <FullWindowOverlay>{children}</FullWindowOverlay> : <>{children}</>;
}
