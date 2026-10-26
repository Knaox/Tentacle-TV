/**
 * Octave — la règle du cache disque des pochettes (bureau), pure et testée :
 * QUELLE entrée pour quelle adresse, QUI peut être demandé, QUOI effacer.
 *
 * - La clé d'une pochette : son adresse SANS jeton (`api_key`, `ApiKey`), ses
 *   paramètres triés — l'élément, la taille et l'étiquette (`tag`) en font
 *   partie : une pochette CHANGÉE dans Jellyfin (nouvelle étiquette) est une
 *   autre entrée, donc rechargée. Un jeton renouvelé ne recharge rien.
 * - Rangé PAR IDENTITÉ (serveur + compte, profil compris), comme le cache des
 *   pages d'Octave : 4 identités au plus, les plus récentes, et un plafond
 *   d'octets par identité (les moins récemment servies partent d'abord).
 * - Une adresse sans étiquette (relais d'une extension, image d'un autre hôte)
 *   se relit au bout de 30 jours : elle a pu changer sous la même adresse.
 */

/** Plafond d'octets par identité. */
export const ART_MAX_BYTES_PER_OWNER = 200 * 1024 * 1024;
/** Au plus tant d'identités gardées sur la machine. */
export const ART_MAX_OWNERS = 4;
/** Une image sans étiquette se relit après ce délai. */
export const ART_UNTAGGED_MAX_AGE_MS = 30 * 24 * 3_600_000;
/** Une pochette n'est pas un média : au-delà, ce n'est pas une image. */
export const ART_MAX_BYTES = 6 * 1024 * 1024;

const TOKEN_PARAMS = new Set(["api_key", "apikey", "x-emby-token", "token"]);

/** L'adresse peut-elle être demandée par le cache ? http(s) seulement, bornée. */
export function isFetchableArt(upstream: string): boolean {
  if (upstream.length > 2_000) return false;
  try {
    const url = new URL(upstream);
    return (url.protocol === "https:" || url.protocol === "http:") && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

/** La clé normalisée (sans jeton, paramètres triés) ; null pour une adresse refusée. */
export function artKey(upstream: string): string | null {
  if (!isFetchableArt(upstream)) return null;
  const url = new URL(upstream);
  const params = [...url.searchParams.entries()].filter(([name]) => !TOKEN_PARAMS.has(name.toLowerCase()));
  params.sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  const query = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
}

/** L'adresse porte-t-elle une étiquette (elle change quand l'image change) ? */
export function isTaggedArt(key: string): boolean {
  return /[?&]tag=/.test(key);
}

/** L'entrée écrite à `writtenAt` est-elle encore bonne à servir ? */
export function isFreshArt(key: string, writtenAt: number, now: number): boolean {
  return isTaggedArt(key) || now - writtenAt <= ART_UNTAGGED_MAX_AGE_MS;
}

/** Le type d'une image d'après ses premiers octets (jamais d'après ce qu'annonce le serveur). */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  const avif = String.fromCharCode(...bytes.slice(4, 12));
  return avif === "ftypavif" ? "image/avif" : null;
}

export interface ArtFile {
  /** Le dossier de l'identité. */
  owner: string;
  /** Le chemin du fichier (rendu tel quel au plan d'éviction). */
  path: string;
  size: number;
  /** Dernière fois servi (l'horodatage d'accès du fichier, tenu à jour par le cache). */
  usedAt: number;
}

/**
 * Ce qu'il faut effacer : les identités au-delà des `maxOwners` plus récentes
 * (celle en cours toujours gardée), puis, identité par identité, les fichiers
 * les moins récemment servis au-delà du plafond.
 */
export function artEvictionPlan(files: readonly ArtFile[], currentOwner: string | null, maxBytes = ART_MAX_BYTES_PER_OWNER, maxOwners = ART_MAX_OWNERS): string[] {
  const byOwner = new Map<string, ArtFile[]>();
  for (const f of files) byOwner.set(f.owner, [...(byOwner.get(f.owner) ?? []), f]);
  const recency = (list: readonly ArtFile[]) => Math.max(...list.map((f) => f.usedAt));
  const owners = [...byOwner.keys()].sort((a, b) => (a === currentOwner ? -1 : b === currentOwner ? 1 : recency(byOwner.get(b)!) - recency(byOwner.get(a)!)));
  const drop: string[] = [];
  owners.forEach((owner, rank) => {
    const list = [...byOwner.get(owner)!].sort((a, b) => b.usedAt - a.usedAt);
    let bytes = 0;
    for (const f of list) {
      bytes += f.size;
      if (rank >= maxOwners || bytes > maxBytes) drop.push(f.path);
    }
  });
  return drop;
}
