import { SetupError } from "../setupErrors";
import { setupRuntime } from "../setupRuntime";
import { checkSiblingNetwork, type SiblingCheckDeps } from "./siblingCheck";

/**
 * Pile complète : le serveur ne parle qu'au Jellyfin de SA pile, par son
 * adresse interne (`JELLYFIN_INTERNAL_URL`) — l'adresse envoyée par le
 * navigateur est ignorée. Ailleurs, celle que l'administrateur a choisie.
 */
export async function assertStackSibling(siblingUrl: string, deps?: SiblingCheckDeps): Promise<void> {
  if ((await checkSiblingNetwork(siblingUrl, deps)) === "elsewhere") throw new SetupError("jf_sibling_elsewhere");
}

export async function jellyfinTarget(requested: string): Promise<string> {
  const { siblingUrl } = setupRuntime().deployment;
  if (!siblingUrl) return requested;
  await assertStackSibling(siblingUrl);
  return siblingUrl;
}
