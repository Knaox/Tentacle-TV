import { getDatabaseUrlSource, hasDatabaseUrl, hasPrisma } from "../services/db";
import type { FastifyRequest } from "fastify";
import { isWebUiEnabled } from "../static/webUi";
import { flowState } from "./flow/setupFlow";
import { clientUrlFor } from "./jellyfin/clientUrlFor";
import { chosenOverStack, claimedAdminId, joinedConfiguredJellyfin, storedJellyfin } from "./setupStore";
import { setupRuntime } from "./setupRuntime";
import type { SetupContext } from "./setupWizardContract";

/**
 * `GET /api/setup/context` — de quoi choisir les étapes de l'assistant. Jamais
 * un secret : ni la clé de Jellyfin, ni l'URL de la base, ni un mot de passe.
 */
export function buildSetupContext(request: FastifyRequest): SetupContext {
  const { deployment, os, provisioner } = setupRuntime();
  // Pile complète : un Jellyfin enregistré qui n'est pas celui de la pile ne compte pas
  // (une base reprise d'un autre essai) — le verrouillage du voisin l'oubliera —, sauf
  // s'il a été choisi EXPRÈS dans l'assistant.
  const recorded = storedJellyfin();
  const sibling = deployment.siblingUrl;
  const stored = recorded && (!sibling || recorded.url === sibling || recorded.url === chosenOverStack()) ? recorded : null;
  const flow = flowState();
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
      // Le verrouillage ne compte que tant que le voisin est le Jellyfin relié.
      claimed: claimedAdminId() !== null && (!sibling || stored?.url === sibling),
      joined: stored !== null && joinedConfiguredJellyfin(),
      // Celle du Jellyfin CHOISI (avant même d'y être relié), sinon du relié.
      clientUrl: clientUrlFor(request, flow.selection?.url ?? stored?.url ?? null),
    },
    flow,
    mediaHostPath: deployment.mediaHostPath,
    mediaFolders: deployment.mediaFolders,
    os: os ? { id: os.id, name: os.name, family: os.family } : null,
    missingJellyfin: provisioner.missingGuide(),
    secure: request.protocol === "https",
    webUi: isWebUiEnabled(),
  };
}
