import { deleteConfigValue } from "../../services/configStore";
import { revokeApiKey } from "../jellyfin/accounts";
import { designatesSibling, presentsAsBlank, probeTarget } from "../jellyfin/stackTarget";
import { SetupError } from "../setupErrors";
import { pathForServer, type SetupSelection } from "../setupFlowContract";
import { setupRuntime } from "../setupRuntime";
import { SETUP_KEYS, claimedAdminId, rememberStackChoice, storedJellyfin } from "../setupStore";
import { isLinked, keyCreatedFor, readSelection, requireStep, saveSelection } from "./setupFlow";

/**
 * `POST /jellyfin/select` — le Jellyfin choisi d'un geste de l'administrateur.
 * Le SERVEUR le sonde et en tire le parcours : neuf (ou celui de la pile,
 * verrouillé en attendant) → `fresh`, déjà configuré → `configured`. Le
 * client n'a pas son mot à dire.
 *
 * Le même Jellyfin, déjà relié : rien ne change (ce qui est fait reste fait).
 * Un AUTRE : ce qui avait été préparé pour l'ancien est oublié — sa clé
 * « Tentacle » révoquée si cette installation l'avait créée. Le Jellyfin de
 * la pile verrouillé au démarrage n'est jamais délié ici : sa clé est mise de
 * côté au moment de relier l'autre (`setClaimAside`), un retour sur lui la reprend.
 */
const trimmed = (url: string): string => url.trim().replace(/\/+$/, "").toLowerCase();

/** L'adresse envoyée désigne le Jellyfin choisi (celui de la pile : aussi par une adresse vide). */
export function designatesSelection(requested: string, selection: SetupSelection): boolean {
  if (trimmed(requested) === trimmed(selection.url)) return true;
  const { siblingUrl } = setupRuntime().deployment;
  return selection.inStack && !!siblingUrl && designatesSibling(requested, siblingUrl);
}

/** Oublier le Jellyfin relié pour un autre parcours (jamais le voisin verrouillé, cf. plus haut). */
async function abandonLinked(nextUrl: string, log: (message: string) => void): Promise<void> {
  const stored = storedJellyfin();
  if (!stored || stored.url === nextUrl) return;
  const { siblingUrl } = setupRuntime().deployment;
  if (siblingUrl && stored.url === siblingUrl && claimedAdminId() !== null) return;
  if (keyCreatedFor() === stored.url) {
    const revoked = await revokeApiKey(stored.url, stored.apiKey);
    log(revoked ? "clé « Tentacle » révoquée sur le Jellyfin abandonné" : "clé « Tentacle » du Jellyfin abandonné non révoquée (injoignable)");
  }
  for (const key of [SETUP_KEYS.jellyfinUrl, SETUP_KEYS.apiKey, SETUP_KEYS.serverId, SETUP_KEYS.joined, SETUP_KEYS.stackChoice, SETUP_KEYS.keyCreatedFor]) {
    await deleteConfigValue(key);
  }
  log("un autre Jellyfin a été choisi : celui préparé avant est oublié");
}

export async function selectJellyfin(requested: string, log: (message: string) => void): Promise<SetupSelection> {
  requireStep("select");
  const current = readSelection();
  const { probed, inStack } = await probeTarget(requested);
  if (!probed.compatible) throw new SetupError("jf_incompatible_version");
  const same = current !== null && (current.url === probed.url || current.serverId === probed.id);
  // Déjà relié : son parcours est celui qu'on a mené (un Jellyfin neuf qu'on vient de configurer reste « neuf »).
  if (same && isLinked(current)) return current;

  await abandonLinked(probed.url, log);
  const selection: SetupSelection = {
    url: probed.url,
    serverId: probed.id,
    serverName: probed.serverName,
    version: probed.version,
    inStack,
    path: pathForServer({ blank: presentsAsBlank(probed, inStack) }),
  };
  await saveSelection(selection);
  // Pile complète : un autre Jellyfin choisi EXPRÈS survit au redémarrage (le verrouillage ne l'oublie pas).
  await rememberStackChoice(selection.url, setupRuntime().deployment.siblingUrl);
  log(`Jellyfin choisi : ${inStack ? "celui de la pile" : "un autre"}, ${selection.path === "fresh" ? "neuf" : "déjà configuré"}`);
  return selection;
}
