import { useDatabaseMigrationGate } from "@tentacle-tv/api-client";
import { probeNow } from "@/offline/connectivityStore";
import { DatabaseMigrationScreen } from "./DatabaseMigrationScreen";
import { useReportStartupOverlay } from "@/startup/useStartupOverlay";
import { BootAwareOverlay } from "@/bootIntro/BootAwareModal";

/**
 * La SEULE porte de l'écran d'attente de la migration de la base sur le
 * mobile : montée une fois, à la racine, dès que le serveur est connu. La
 * décision est celle de tous les clients (`useDatabaseMigrationGate`) ; au
 * retour, la connectivité se resonde aussi tout de suite.
 *
 * Sur iOS, le lecteur est une modale NATIVE au-dessus de la racine : l'écran
 * passe par une `FullWindowOverlay`, posée seulement quand il est là (le patron
 * de `SessionMessageHost`). Sur Android, une vue après la pile suffit. Née
 * pendant l'ouverture du démarrage, elle vit dans l'écran du poulpe
 * (`BootAwareOverlay`) : c'est elle le premier écran.
 */
export function DatabaseMigrationHost({ serverUrl }: { serverUrl: string | null }) {
  const view = useDatabaseMigrationGate({ backendUrl: serverUrl, onResume: resume });
  useReportStartupOverlay("migration", view ? "active" : "quiet");
  if (!view) return null;
  return <BootAwareOverlay bootOverlay="migration"><DatabaseMigrationScreen view={view} /></BootAwareOverlay>;
}

const resume = () => void probeNow(true);
