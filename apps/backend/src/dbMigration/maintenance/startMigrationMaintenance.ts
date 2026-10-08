import { maintenanceConfigBody, maintenanceHealthBody } from "./maintenanceBodies";
import { startMaintenanceServer } from "./maintenanceServer";

/**
 * Le serveur de maintenance de la migration, sur le port du serveur : l'état
 * public et la page d'attente minimale. Rend sa fermeture — le démarrage normal
 * reprend ensuite sur le même port.
 */
export async function startMigrationMaintenance(port: number, host: string): Promise<() => Promise<void>> {
  const app = await startMaintenanceServer({ port, host, healthBody: maintenanceHealthBody, configBody: maintenanceConfigBody });
  console.log(`[db-migration] Écran d'attente servi sur le port ${port}`);
  return () => app.close();
}
