import { getDatabaseUrlSource, hasDatabaseUrl, hasPrisma } from "../services/db";
import { claimedAdminId, storedJellyfin } from "./setupStore";
import { setupRuntime } from "./setupRuntime";
import type { SetupContext } from "./setupWizardContract";

/**
 * `GET /api/setup/context` — de quoi choisir les étapes de l'assistant. Jamais
 * un secret : ni la clé de Jellyfin, ni l'URL de la base, ni un mot de passe.
 */
export function buildSetupContext(secure: boolean): SetupContext {
  const { deployment, os, provisioner } = setupRuntime();
  const stored = storedJellyfin();
  return {
    deployment: deployment.deployment,
    stack: deployment.stack,
    provisioner: provisioner.kind,
    database: {
      configured: hasDatabaseUrl(),
      connected: hasPrisma(),
      fromEnv: getDatabaseUrlSource() === "env",
    },
    jellyfin: {
      url: stored?.url ?? null,
      suggestedUrl: provisioner.suggestedUrl,
      configured: stored !== null,
      claimed: claimedAdminId() !== null,
    },
    mediaHostPath: deployment.mediaHostPath,
    mediaFolders: deployment.mediaFolders,
    os: os ? { id: os.id, name: os.name, family: os.family } : null,
    missingJellyfin: provisioner.missingGuide(),
    secure,
  };
}
