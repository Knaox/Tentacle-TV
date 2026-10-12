import type { ProvisionerKind, MissingJellyfinGuide } from "../setupWizardContract";
import { suggestedJellyfinUrl, type Deployment } from "../deployment";
import { missingJellyfinGuide, type HostOs } from "../hostOs";
import { appHostServes, detectLocalJellyfin, detectedJellyfinUrl } from "../appHost/appHostCalls";
import { JELLYFIN_WINDOWS_DOWNLOAD_URL } from "../../serverHost/hostMethods";
import { claimSiblingJellyfin, type ClaimOutcome } from "./siblingClaim";

/**
 * D'où vient Jellyfin — un seul assistant pour tous les cas, une seule
 * interface. Le SERVEUR ne lance jamais Jellyfin lui-même : la pile Docker,
 * la commande officielle ou l'hôte de l'app Windows s'en chargent ; le
 * provisionneur dit où le chercher, ce qu'il prépare seul au démarrage, et
 * quoi proposer s'il manque.
 *
 *  - `existing-instance` : un Jellyfin déjà là, ailleurs (piles « base » et
 *    « seule », ou l'ancien compose) ;
 *  - `docker-sibling` : le Jellyfin de la pile complète, verrouillé au démarrage ;
 *  - `native-host` : Tentacle installé sur la machine, Jellyfin à côté ;
 *  - `managed-by-tentacle` : l'app Windows « Tentacle Server » — son hôte
 *    détecte le Jellyfin de la machine (le port lu dans sa configuration
 *    devient l'adresse proposée), l'installe avec l'accord de
 *    l'administrateur, et le démarre (`appHost/`).
 */
export interface JellyfinProvisioner {
  readonly kind: ProvisionerKind;
  /** L'adresse proposée d'office à l'assistant. */
  readonly suggestedUrl: string | null;
  /** Ce qui se fait seul au démarrage, installation ouverte ; `null` : rien. */
  prepare(): Promise<ClaimOutcome | null>;
  /** Sans Jellyfin : la commande, la documentation, la pile complète ou l'installation guidée. */
  missingGuide(): MissingJellyfinGuide;
}

const nothingToPrepare = async (): Promise<null> => null;

export function existingInstance(deployment: Deployment, os: HostOs | null): JellyfinProvisioner {
  return {
    kind: "existing-instance",
    suggestedUrl: suggestedJellyfinUrl(deployment),
    prepare: nothingToPrepare,
    missingGuide: () => missingJellyfinGuide(deployment, os),
  };
}

export function dockerSibling(deployment: Deployment, siblingUrl: string): JellyfinProvisioner {
  return {
    kind: "docker-sibling",
    suggestedUrl: siblingUrl,
    prepare: () => claimSiblingJellyfin(siblingUrl),
    missingGuide: () => missingJellyfinGuide(deployment, null),
  };
}

export function nativeHost(deployment: Deployment, os: HostOs | null): JellyfinProvisioner {
  return { ...existingInstance(deployment, os), kind: "native-host" };
}

/**
 * L'app Windows : l'adresse proposée est celle que l'hôte a DÉTECTÉE (au
 * démarrage, puis à chaque détection de l'assistant), sinon celle d'une
 * installation native. Sans hôte qui sache installer : la documentation, comme
 * pour une installation à la main.
 */
export function managedByTentacle(deployment: Deployment, os: HostOs | null): JellyfinProvisioner {
  return {
    kind: "managed-by-tentacle",
    get suggestedUrl() {
      return detectedJellyfinUrl() ?? suggestedJellyfinUrl(deployment);
    },
    prepare: async () => {
      if (appHostServes("jellyfin.detect")) await detectLocalJellyfin().catch(() => undefined);
      return null;
    },
    missingGuide: () =>
      appHostServes("jellyfin.install") ? { kind: "install", docsUrl: JELLYFIN_WINDOWS_DOWNLOAD_URL } : missingJellyfinGuide(deployment, os),
  };
}

export function provisionerFor(deployment: Deployment, os: HostOs | null): JellyfinProvisioner {
  switch (deployment.provisioner) {
    case "docker-sibling":
      return deployment.siblingUrl ? dockerSibling(deployment, deployment.siblingUrl) : existingInstance(deployment, os);
    case "native-host":
      return nativeHost(deployment, os);
    case "managed-by-tentacle":
      return managedByTentacle(deployment, os);
    default:
      return existingInstance(deployment, os);
  }
}
