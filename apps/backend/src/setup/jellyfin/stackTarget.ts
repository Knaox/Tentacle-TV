import { SetupError } from "../setupErrors";
import { setupRuntime } from "../setupRuntime";
import { claimedAdminId } from "../setupStore";
import { probeJellyfin, type ProbedJellyfin } from "./probe";
import { checkSiblingNetwork, type SiblingCheckDeps } from "./siblingCheck";

/**
 * Pile complète : le Jellyfin de SA pile se joint par son adresse interne
 * (`JELLYFIN_INTERNAL_URL`), jamais par une adresse envoyée par le navigateur
 * — même quand c'est lui qu'on voit par son port publié. Les autres Jellyfin
 * restent choisissables (la liste de l'assistant les montre) : leur adresse
 * est celle choisie, gardée comme dans une pile sans Jellyfin.
 */
export async function assertStackSibling(siblingUrl: string, deps?: SiblingCheckDeps): Promise<void> {
  if ((await checkSiblingNetwork(siblingUrl, deps)) === "elsewhere") throw new SetupError("jf_sibling_elsewhere");
}

const trimmed = (url: string): string => url.trim().replace(/\/+$/, "").toLowerCase();

/** L'adresse demandée désigne le Jellyfin de la pile (ou rien : l'assistant le propose d'office). */
export function designatesSibling(requested: string, siblingUrl: string): boolean {
  return requested.trim() === "" || trimmed(requested) === trimmed(siblingUrl);
}

export interface Target {
  probed: ProbedJellyfin;
  /** C'est le Jellyfin de la pile, joint par son adresse interne. */
  inStack: boolean;
}

export interface TargetDeps {
  siblingUrl: string | null;
  probe: (url: string) => Promise<ProbedJellyfin>;
  assertSibling: (url: string) => Promise<void>;
}

const systemDeps = (): TargetDeps => ({
  siblingUrl: setupRuntime().deployment.siblingUrl,
  probe: (url) => probeJellyfin(url),
  assertSibling: (url) => assertStackSibling(url),
});

/** Le Jellyfin visé, sondé. Celui de la pile vu par un autre chemin (même identifiant) redevient lui. */
export async function probeTarget(requested: string, deps: TargetDeps = systemDeps()): Promise<Target> {
  const { siblingUrl } = deps;
  if (!siblingUrl) return { probed: await deps.probe(requested), inStack: false };
  if (designatesSibling(requested, siblingUrl)) {
    await deps.assertSibling(siblingUrl);
    return { probed: await deps.probe(siblingUrl), inStack: true };
  }
  const probed = await deps.probe(requested);
  const sibling = await deps.probe(siblingUrl).catch(() => null);
  if (sibling && sibling.id === probed.id) {
    await deps.assertSibling(siblingUrl);
    return { probed: sibling, inStack: true };
  }
  return { probed, inStack: false };
}

/**
 * Le Jellyfin de la pile verrouillé par Tentacle n'est plus « vierge » pour
 * Jellyfin ; pour l'administrateur, si : c'est le compte choisi dans
 * l'assistant qui le prendra.
 */
export function presentsAsBlank(probed: Pick<ProbedJellyfin, "blank">, inStack: boolean): boolean {
  return probed.blank || (inStack && claimedAdminId() !== null);
}
