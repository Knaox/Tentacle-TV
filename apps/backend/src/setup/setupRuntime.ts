import { hasPrisma } from "../services/db";
import { isSetupComplete } from "../services/configStore";
import { readDeployment, type Deployment } from "./deployment";
import { detectHostOs, type HostOs } from "./hostOs";
import { configureJellyfinGuard } from "./jellyfin/guardedFetch";
import { provisionerFor, type JellyfinProvisioner } from "./provisioners";
import type { ClaimOutcome } from "./provisioners/siblingClaim";
import { isSetupClosed, sealSetup } from "./setupLock";
import { discardSetupToken, readSetupToken, setupTokenBanner, writeNewSetupToken } from "./setupToken";

/**
 * Ce que l'assistant sait de l'installation, lu UNE fois par processus, et ce
 * qu'il fait seul au démarrage.
 */
export interface SetupRuntime {
  deployment: Deployment;
  os: HostOs | null;
  provisioner: JellyfinProvisioner;
}

let runtime: SetupRuntime | null = null;
let bannerPort: number | string = 3000;

export function setupRuntime(): SetupRuntime {
  if (!runtime) {
    const deployment = readDeployment();
    const os = deployment.deployment === "native" ? detectHostOs() : null;
    runtime = { deployment, os, provisioner: provisionerFor(deployment, os) };
    configureJellyfinGuard({ allowLoopback: deployment.deployment === "native" });
  }
  return runtime;
}

function announceNewToken(): void {
  for (const line of setupTokenBanner(writeNewSetupToken(), bannerPort)) console.log(line);
}

let claim: Promise<ClaimOutcome | null> | null = null;

/** Verrouille le Jellyfin voisin s'il est vierge — un seul essai à la fois. */
export function prepareJellyfin(): Promise<ClaimOutcome | null> {
  if (!claim) {
    claim = setupRuntime()
      .provisioner.prepare()
      .catch((err: unknown) => {
        console.warn("[Setup] préparation de Jellyfin interrompue :", err instanceof Error ? err.message : err);
        return null;
      })
      .finally(() => {
        claim = null;
      });
  }
  return claim;
}

/**
 * Au démarrage, après la lecture de la base. Installation finie → le fichier
 * verrou (une installation d'avant n'en avait pas) et plus de code ; ouverte
 * → un code NEUF dans les journaux, et le Jellyfin voisin verrouillé.
 */
export function bootSetup(port: number | string): void {
  bannerPort = port;
  setupRuntime();
  if (isSetupComplete()) sealSetup();
  if (isSetupClosed()) {
    discardSetupToken();
    return;
  }
  announceNewToken();
  if (hasPrisma()) void prepareJellyfin();
}

const MAX_FAILED_CODES = 10;
let failedCodes = 0;

/**
 * Trop de codes faux, toutes adresses confondues : le code en vigueur change.
 * La limite par adresse (5 par minute) arrête un essayeur ; celle-ci, un
 * essaim. Les sessions ouvertes restent : un flot de codes faux ne doit pas
 * mettre dehors le propriétaire en pleine installation. Et un code déjà
 * échangé n'est pas remplacé — rien à deviner.
 */
export function noteFailedCode(): void {
  failedCodes += 1;
  if (failedCodes < MAX_FAILED_CODES) return;
  failedCodes = 0;
  if (!readSetupToken()) return;
  console.warn("[Setup] trop de codes faux : nouveau code d'installation");
  announceNewToken();
}

export function noteAcceptedCode(): void {
  failedCodes = 0;
}
