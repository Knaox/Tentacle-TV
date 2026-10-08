import { registerStaticClients } from "../../static/staticClients";
import { isWebUiEnabled } from "../../static/webUi";
import { maintenanceConfigBody, maintenanceHealthBody } from "./maintenanceBodies";
import { startMaintenanceServer } from "./maintenanceServer";

/**
 * Le serveur de maintenance de la migration, avec les clients statiques : le
 * client web y montre l'écran d'attente. L'interface web coupée par
 * l'administrateur le reste ; l'installation compte pour FINIE (l'assistant ne
 * s'ouvre jamais pendant une migration, audit S3). Rend sa fermeture.
 */
export async function startMigrationMaintenance(port: number, host: string): Promise<() => Promise<void>> {
  const app = await startMaintenanceServer({
    port,
    host,
    healthBody: maintenanceHealthBody,
    configBody: maintenanceConfigBody,
    registerStatic: (instance) => registerStaticClients(instance, { webUi: () => ({ enabled: isWebUiEnabled(), setupComplete: true }) }),
  });
  console.log(`[db-migration] Écran d'attente servi sur le port ${port}`);
  return () => app.close();
}
