import { getDatabaseUrlSource, hasDatabaseUrl, hasPrisma } from "../services/db";
import { clientJellyfinUrl } from "./jellyfin/clientUrl";
import { claimedAdminId, storedJellyfin } from "./setupStore";
import { setupRuntime } from "./setupRuntime";
import type { SetupContext } from "./setupWizardContract";

/**
 * `GET /api/setup/context` — de quoi choisir les étapes de l'assistant. Jamais
 * un secret : ni la clé de Jellyfin, ni l'URL de la base, ni un mot de passe.
 */
export function buildSetupContext(secure: boolean, browserHost?: string): SetupContext {
  const { deployment, os, provisioner } = setupRuntime();
  // Pile complète : un Jellyfin enregistré qui n'est pas celui de la pile ne compte pas
  // (une base reprise d'un autre essai) — le verrouillage du voisin l'oubliera.
  const recorded = storedJellyfin();
  const stored = recorded && (!deployment.siblingUrl || recorded.url === deployment.siblingUrl) ? recorded : null;
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
      clientUrl: clientJellyfinUrl({ deployment, browserHost, jellyfinUrl: stored?.url ?? null }),
    },
    mediaHostPath: deployment.mediaHostPath,
    mediaFolders: deployment.mediaFolders,
    os: os ? { id: os.id, name: os.name, family: os.family } : null,
    missingJellyfin: provisioner.missingGuide(),
    secure,
  };
}
