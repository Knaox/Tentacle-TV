import { useEffect } from "react";
import { useDatabaseMigrationGate } from "@tentacle-tv/api-client";
import { DatabaseMigrationScreen } from "@/databaseMigration/DatabaseMigrationScreen";
import { probeNow } from "@/offline/connectivityStore";
import { registerBack } from "../../focus/back";
import { yieldToTv } from "../../auth/returnToShell";
import { holdBackDuringMigration } from "./migrationBack";

/**
 * La porte de l'écran d'attente de la migration de la base sur la LG, dans
 * une session déjà ouverte (une page rechargée reçoit, elle, la page
 * d'attente du serveur). La décision et l'écran sont ceux du web
 * (`useDatabaseMigrationGate`, `DatabaseMigrationScreen`) : son
 * `role="alertdialog"` retient le moteur de focus (`trappingContainer`), sans
 * rien de focalisable ; Retour rend la main au téléviseur.
 */
export function DatabaseMigrationGateTv() {
  const view = useDatabaseMigrationGate({ backendUrl: "", onResume: resume });
  const shown = view !== null;
  useEffect(() => (shown ? holdBackDuringMigration(registerBack, yieldToTv) : undefined), [shown]);
  return view ? <DatabaseMigrationScreen view={view} /> : null;
}

const resume = () => void probeNow(true);
