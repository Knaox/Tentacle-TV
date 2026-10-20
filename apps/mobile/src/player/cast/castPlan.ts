/**
 * La diffusion vers une TV (Google Cast) — les règles pures : quelle adresse
 * donner à la TV, quelle position, quel état afficher.
 *
 * La TV n'a ni notre session ni nos en-têtes : l'URL qu'on lui donne porte sa
 * clé (`api_key` / `ApiKey`) et doit être JOIGNABLE DEPUIS ELLE. Le téléphone
 * connaît deux adresses : celle de Jellyfin réglée pour les applications
 * (lecture directe, `jellyfin_private_url` / publique — jamais un nom de
 * conteneur) et celle du serveur Tentacle. Un Chromecast ne résout ni un nom
 * sans domaine (« jellyfin », « nas ») ni un `.local` (mDNS) : une adresse IP
 * ou un vrai nom de domaine passe d'abord.
 */

/** Un hôte que la TV saura joindre : une IP, ou un nom de domaine qui n'est pas mDNS. */
export function castReachableHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h.startsWith("127.") || h === "::1") return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return true;
  if (!h.includes(".")) return false;
  return !h.endsWith(".local");
}

function hostOf(url: string): string | null {
  const match = /^https?:\/\/(\[[^\]]+\]|[^/:?#]+)/i.exec(url);
  return match ? match[1] : null;
}

/**
 * La première URL que la TV saura joindre, dans l'ordre de préférence donné ;
 * `null` si aucune — mieux vaut le dire que d'envoyer la TV dans le vide.
 */
export function pickCastUrl(candidates: readonly (string | null | undefined)[]): string | null {
  for (const url of candidates) {
    if (!url) continue;
    const host = hostOf(url);
    if (host && castReachableHost(host)) return url;
  }
  return null;
}

/** La clé de la TV dans l'URL : la TV n'envoie aucun en-tête. Rien si une clé y est déjà. */
export function withCastAuth(url: string, token: string | null): string {
  if (!token || /[?&](api_key|ApiKey)=/i.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(token)}`;
}

/**
 * Les positions : un flux transcodé commence au `StartTimeTicks` demandé (le
 * récepteur y voit 0) ; un fichier lu tel quel commence au début (le récepteur
 * s'y place lui-même). `offset` est le début du flux, en secondes du TITRE.
 */
export function castLoadStart(directPlay: boolean, itemSeconds: number): number {
  return directPlay ? Math.max(0, itemSeconds) : 0;
}

/** Une position du récepteur, en secondes du TITRE (pour Jellyfin et la barre). */
export function castItemPosition(receiverSeconds: number, offset: number): number {
  return Math.max(0, receiverSeconds) + Math.max(0, offset);
}

/** Une cible en secondes du TITRE, en position du récepteur. */
export function castReceiverTarget(itemSeconds: number, offset: number): number {
  return Math.max(0, itemSeconds - Math.max(0, offset));
}

export type CastPhase = "idle" | "connecting" | "loading" | "playing" | "paused" | "buffering" | "finished" | "failed";

/** L'état affiché, d'après celui du récepteur (et la connexion). */
export function castPhase(
  connection: "connecting" | "connected" | "other",
  playerState: "idle" | "playing" | "paused" | "buffering" | "loading" | null,
  idleReason: "finished" | "cancelled" | "interrupted" | "error" | null,
  loadRequested: boolean,
): CastPhase {
  if (connection === "connecting") return "connecting";
  if (connection !== "connected") return "idle";
  if (playerState === "playing" || playerState === "paused" || playerState === "buffering" || playerState === "loading") return playerState;
  if (idleReason === "finished") return "finished";
  if (idleReason === "error") return "failed";
  return loadRequested ? "loading" : "idle";
}
