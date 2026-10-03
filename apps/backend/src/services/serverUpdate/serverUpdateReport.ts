import { BOOT_ID } from "../pluginRestart";
import { BACKEND_VERSION } from "../version";
import { readInstall } from "./installInfo";
import { getServerReleaseState, refreshServerRelease, serverUpdateCheckEnabled } from "./serverReleases";
import { compareServerVersions, type ServerUpdateReport } from "./serverUpdateContract";

/**
 * Le rapport de la carte « Serveur Tentacle » : la version en service, la
 * dernière publiée (relue si elle a vieilli), ce que les clients exigent, et
 * l'installation. `bootId` change à chaque redémarrage : la carte reconnaît
 * ainsi d'elle-même le serveur revenu d'une mise à jour.
 */
export async function buildServerUpdateReport(force: boolean): Promise<ServerUpdateReport> {
  await refreshServerRelease(force);
  const { latest, versions, minServer, checkedAt, error } = getServerReleaseState();
  const behind = latest
    ? versions.filter((v) => compareServerVersions(v, BACKEND_VERSION) > 0 && compareServerVersions(v, latest.version) <= 0).length
    : 0;
  return {
    current: BACKEND_VERSION,
    bootId: BOOT_ID,
    latest,
    behind,
    requiredByClients: minServer,
    checkedAt,
    error: serverUpdateCheckEnabled() ? error : "off",
    install: readInstall(),
  };
}
