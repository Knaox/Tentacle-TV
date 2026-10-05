import type { ProvisionerKind, MissingJellyfinGuide } from "../setupWizardContract";
import { suggestedJellyfinUrl, type Deployment } from "../deployment";
import { missingJellyfinGuide, type HostOs } from "../hostOs";
import { claimSiblingJellyfin, type ClaimOutcome } from "./siblingClaim";

/**
 * D'où vient Jellyfin — un seul assistant pour tous les cas, une seule
 * interface. Aucun ne lance Jellyfin lui-même : l'installation revient à la
 * pile Docker ou à la commande officielle ; le provisionneur dit où le
 * chercher, ce qu'il prépare seul au démarrage, et quoi proposer s'il manque.
 *
 *  - `existing-instance` : un Jellyfin déjà là, ailleurs (piles « base » et
 *    « seule », ou l'ancien compose) ;
 *  - `docker-sibling` : le Jellyfin de la pile complète, verrouillé au démarrage ;
 *  - `native-host` : Tentacle installé sur la machine, Jellyfin à côté ;
 *  - `managed-by-tentacle` : RÉSERVÉ à la future app d'installation (Windows,
 *    Linux), qui installera Jellyfin elle-même. Rien ne le choisit encore.
 */
export interface JellyfinProvisioner {
  readonly kind: ProvisionerKind;
  /** L'adresse proposée d'office à l'assistant. */
  readonly suggestedUrl: string | null;
  /** Ce qui se fait seul au démarrage, installation ouverte ; `null` : rien. */
  prepare(): Promise<ClaimOutcome | null>;
  /** Sans Jellyfin : la commande, la documentation ou la pile complète. */
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

/** Réservé : la future app d'installation le fournira. */
export function managedByTentacle(): JellyfinProvisioner {
  throw new Error("managed-by-tentacle : réservé à la future app d'installation");
}

export function provisionerFor(deployment: Deployment, os: HostOs | null): JellyfinProvisioner {
  switch (deployment.provisioner) {
    case "docker-sibling":
      return deployment.siblingUrl ? dockerSibling(deployment, deployment.siblingUrl) : existingInstance(deployment, os);
    case "native-host":
      return nativeHost(deployment, os);
    case "managed-by-tentacle":
      return managedByTentacle();
    default:
      return existingInstance(deployment, os);
  }
}
