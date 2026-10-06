import { randomBytes } from "crypto";
import { deleteConfigValue, getConfigValue, setConfigValue } from "../../services/configStore";
import { apiKeyWorks, authenticate, createTentacleKey, signOut } from "../jellyfin/accounts";
import { probeJellyfin, type ProbedJellyfin } from "../jellyfin/probe";
import { checkSiblingNetwork, type SiblingCheckDeps } from "../jellyfin/siblingCheck";
import { finishJellyfinStartup, runJellyfinStartup } from "../jellyfin/startup";
import { forgetSelection, readSelection } from "../flow/setupFlow";
import { SETUP_KEYS, chosenOverStack, forgetJellyfin, saveJellyfin, storedJellyfin } from "../setupStore";

/**
 * Pile complète : le Jellyfin voisin naît VIERGE, et tant que personne n'a
 * fini son assistant, ses routes `/Startup/*` sont ouvertes à tout le réseau
 * (`FirstTimeSetupOrElevated`) — le premier venu en deviendrait
 * l'administrateur. Tentacle le referme dès son démarrage : un administrateur
 * PROVISOIRE au mot de passe aléatoire, et la clé « Tentacle ». L'assistant
 * de Tentacle lui donne ensuite le nom et le mot de passe choisis
 * (`adoptProvisionalAdmin`).
 *
 * Le mot de passe provisoire est enregistré AVANT de créer le compte : un
 * arrêt entre les deux étapes ne laisse pas un Jellyfin verrouillé dont
 * personne n'a la clé — le démarrage suivant reprend là.
 */
export type ClaimOutcome = "claimed" | "already" | "not-blank" | "unreachable" | "elsewhere";

export const PROVISIONAL_ADMIN = "tentacle-setup";

interface ClaimOptions {
  /** Attente du premier démarrage de Jellyfin (migrations de sa base). */
  waitMs?: number;
  intervalMs?: number;
  log?: (message: string) => void;
  network?: SiblingCheckDeps;
}

async function waitForJellyfin(url: string, waitMs: number, intervalMs: number): Promise<ProbedJellyfin | null> {
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      return await probeJellyfin(url);
    } catch {
      if (Date.now() >= deadline) return null;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

const PROVISIONAL_LOCALE = { uiCulture: "en-US", metadataCountry: "US", metadataLanguage: "en" };

/** La clé « Tentacle » au nom de l'administrateur provisoire, enregistrée ; `null` si son compte ne s'ouvre pas. */
async function keyFromProvisionalAdmin(probed: ProbedJellyfin, secret: string): Promise<string | null> {
  try {
    const account = await authenticate(probed.url, PROVISIONAL_ADMIN, secret);
    if (!account.isAdmin) return null;
    const key = await createTentacleKey(probed.url, account.token);
    await signOut(probed.url, account.token);
    await setConfigValue(SETUP_KEYS.claimUserId, account.id);
    await saveJellyfin(probed.url, key, probed.id);
    await deleteConfigValue(SETUP_KEYS.claimSecret);
    return key;
  } catch {
    return null;
  }
}

export async function claimSiblingJellyfin(siblingUrl: string, options: ClaimOptions = {}): Promise<ClaimOutcome> {
  const log = options.log ?? ((message: string) => console.log(`[Setup] ${message}`));
  // Un choix fait hors de cette pile (une base reprise d'une pile « base ») ne vaut pas ici :
  // l'assistant le redemandera. Un autre Jellyfin choisi DANS cette pile est gardé (`stackChoice`).
  const selection = readSelection();
  if (selection && selection.url !== siblingUrl && selection.url !== chosenOverStack()) {
    log("un Jellyfin choisi hors de cette pile était retenu — choix oublié, l'assistant le redemandera");
    await forgetSelection();
  }
  const stored = storedJellyfin();
  // Un autre Jellyfin choisi EXPRÈS dans l'assistant (la liste le permet) : gardé, et
  // le voisin n'est pas touché — sa clé, s'il était verrouillé, est déjà de côté.
  if (stored && stored.url !== siblingUrl && stored.url === chosenOverStack()) {
    log("un autre Jellyfin que celui de la pile a été choisi dans l'assistant — gardé");
    return "already";
  }
  // Une base reprise d'un essai précédent peut garder un AUTRE Jellyfin (celui
  // d'une pile « base » sur la même machine) : la pile complète n'en veut pas.
  if (stored && stored.url !== siblingUrl) {
    log("un Jellyfin étranger à la pile était enregistré — oublié, la pile reprend le sien");
    await forgetJellyfin();
  } else if (stored && (await apiKeyWorks(stored.url, stored.apiKey))) return "already";

  const probed = await waitForJellyfin(siblingUrl, options.waitMs ?? 5 * 60_000, options.intervalMs ?? 3_000);
  if (!probed) {
    log("Jellyfin voisin injoignable — l'assistant réessaiera");
    return "unreachable";
  }
  if ((await checkSiblingNetwork(siblingUrl, options.network)) === "elsewhere") {
    log(`${siblingUrl} ne mène pas au Jellyfin de la pile (hors de ses réseaux) — rien n'est verrouillé`);
    return "elsewhere";
  }

  // Un essai précédent a pu poser NOTRE compte sans aller jusqu'à la clé : on le reprend.
  const pending = getConfigValue(SETUP_KEYS.claimSecret) ?? null;
  if (!probed.blank && !pending) {
    log("Jellyfin voisin déjà configuré — l'assistant demandera son compte administrateur");
    return "not-blank";
  }

  const secret = pending ?? randomBytes(24).toString("base64url");
  if (!pending) await setConfigValue(SETUP_KEYS.claimSecret, secret);
  let startupDone = !probed.blank;
  if (probed.blank) {
    try {
      // La langue définitive est posée par l'assistant (`applyServerLocale`).
      await runJellyfinStartup(probed.url, { username: PROVISIONAL_ADMIN, password: secret }, PROVISIONAL_LOCALE);
      startupDone = true;
    } catch (err) {
      if (!pending) {
        // Quelqu'un l'a fini entre la sonde et nous : il a un administrateur, pas le nôtre.
        await deleteConfigValue(SETUP_KEYS.claimSecret);
        const code = (err as { code?: string }).code;
        log(`Jellyfin voisin non verrouillé (${code ?? "erreur"})`);
        return code === "jf_not_blank" ? "not-blank" : "unreachable";
      }
    }
  }

  const key = await keyFromProvisionalAdmin(probed, secret);
  if (!key) {
    log("Jellyfin voisin : compte provisoire refusé — l'assistant demandera son compte administrateur");
    return pending || !probed.blank ? "not-blank" : "unreachable";
  }
  if (!startupDone) await finishJellyfinStartup(probed.url, key).catch(() => undefined);
  log("Jellyfin voisin verrouillé en attendant l'assistant");
  return "claimed";
}
