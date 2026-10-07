/**
 * L'adresse du serveur qu'un client transmet à une TV au jumelage — la TV la
 * grave et s'y connecte ensuite. Règle commune au web, au bureau, au miroir et
 * au mobile :
 *
 *  1. l'adresse que le serveur ANNONCE (`/api/config` → `publicUrl` : lien
 *     public, adresse privée réglée, ou celle par laquelle un client du réseau
 *     local le joint) ;
 *  2. à défaut, l'adresse par laquelle CE client parle au serveur : s'il la
 *     joint, une TV du même réseau la joint aussi. Le jumelage n'exige donc
 *     jamais de lien public.
 *
 * Une adresse que la TV ne saurait pas joindre ne vaut rien : autre chose que
 * http(s) (l'origine `tentacle://app` de la coquille de bureau) ou la machine
 * elle-même (`localhost`, `127.0.0.1`, `[::1]` — un navigateur ouvert sur le
 * serveur, le serveur de développement).
 *
 * Analyse à la main, sans `URL` : le `URL` de React Native n'expose pas
 * `hostname` sur toutes les versions livrées.
 */

const HTTP_URL = /^(https?):\/\/(\[[0-9a-f:.]+\]|[^\s/?#:@[\]]+)(?::(\d{1,5}))?(?:[/?#][^\s]*)?$/i;

function isLoopbackHost(host: string): boolean {
  const bare = host.toLowerCase().replace(/^\[(.*)\]$/, "$1").replace(/\.$/, "");
  if (bare === "localhost" || bare.endsWith(".localhost")) return true;
  if (bare === "::1" || bare === "0.0.0.0" || bare === "::") return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(bare);
}

/** L'adresse, débarrassée de ses `/` finaux, si une TV peut la joindre ; sinon `null`. */
export function reachableServerUrl(raw: string | null | undefined): string | null {
  const url = raw?.trim().replace(/\/+$/, "");
  if (!url) return null;
  const match = HTTP_URL.exec(url);
  if (!match) return null;
  const port = match[3] ? Number(match[3]) : null;
  if (port !== null && (port < 1 || port > 65535)) return null;
  return isLoopbackHost(match[2]) ? null : url;
}

export interface PairingServerUrlInput {
  /** `/api/config` → `publicUrl` (absent d'un serveur qui n'en a pas). */
  advertised: string | null | undefined;
  /** L'adresse par laquelle ce client joint le serveur (base du bureau, du mobile, origine du web). */
  clientServerUrl: string | null | undefined;
}

/** L'adresse à donner à la TV, ou `null` : aucune qu'elle puisse joindre — le jumelage est alors impossible. */
export function pairingServerUrl(input: PairingServerUrlInput): string | null {
  return reachableServerUrl(input.advertised) ?? reachableServerUrl(input.clientServerUrl);
}
