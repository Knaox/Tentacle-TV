import { useDatabaseMigrationGate } from "@tentacle-tv/api-client";
import { probeNow } from "../offline/connectivityStore";
import { DatabaseMigrationScreen } from "./DatabaseMigrationScreen";

/**
 * La SEULE porte de l'écran d'attente de la migration de la base, web et
 * bureau : montée une fois, à la racine (`main.tsx`), à côté de l'application —
 * qu'une session soit ouverte ou non, avant comme après l'assistant.
 *
 * La décision est celle de tous les clients (`useDatabaseMigrationGate`) ; au
 * retour, la connectivité se resonde tout de suite, en plus des requêtes
 * invalidées et de la socket reconnectée par la porte commune.
 */
export function DatabaseMigrationGate({ backendUrl }: { backendUrl: string }) {
  const view = useDatabaseMigrationGate({ backendUrl, onResume: resume });
  return view ? <DatabaseMigrationScreen view={view} /> : null;
}

const resume = () => void probeNow(true);
