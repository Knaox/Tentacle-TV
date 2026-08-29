/**
 * Choisir soi-même la variante Dolby Vision d'un manifeste HLS.
 *
 * # Pourquoi le téléviseur ne peut pas s'en charger
 *
 * Quand Jellyfin remuxe un fichier Dolby Vision, son manifeste maître propose
 * trois variantes, et **elles annoncent toutes le même `BANDWIDTH`** :
 *
 *     VIDEO-RANGE=PQ   CODECS="hvc1…"  SUPPLEMENTAL-CODECS="dvh1.08.06/db1p"
 *     VIDEO-RANGE=SDR  CODECS="hvc1…"  AllowVideoStreamCopy=false
 *     VIDEO-RANGE=SDR  CODECS="avc1…"  AllowVideoStreamCopy=false
 *
 * La première est le remux — l'image est copiée. Les deux autres sont des
 * replis RÉ-ENCODÉS en SDR. Le lecteur HLS de webOS 23 ne départage pas : à
 * débit égal, il prend tantôt l'une, tantôt l'autre. Mesuré sur une C3, six
 * lectures du même manifeste maître : deux tiers en Dolby Vision, un tiers en
 * `hdrType: "none"` avec, côté serveur, une session `réencodé hevc`.
 *
 * Le mauvais choix coûte donc DEUX fois : la plage dynamique, et un
 * ré-encodage 4K permanent là où le serveur n'avait qu'à démultiplexer.
 *
 * Jellyfin place délibérément la variante Dolby Vision en tête — son propre
 * commentaire vise « les clients conformes (Apple TV, webOS 24+) ». Ce
 * téléviseur est en webOS 23 : il est du mauvais côté de cette limite, et c'est
 * au client de trancher à sa place.
 *
 * En désignant la variante directement, la mesure passe à six lectures sur six.
 */

/** Rend l'URL RELATIVE de la variante Dolby Vision, `null` s'il n'y en a pas. */
export function doviVariantLine(manifest: string): string | null {
  const lines = manifest.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
    // `SUPPLEMENTAL-CODECS` est le seul marqueur fiable : `VIDEO-RANGE=PQ`
    // désigne aussi un HDR10 ordinaire, et l'ordre des variantes n'est garanti
    // par aucune spécification.
    if (!line.includes("SUPPLEMENTAL-CODECS")) continue;
    const nextOne = (lines[i + 1] ?? "").trim();
    // Un manifeste tronqué ou une variante sans URL : mieux vaut rendre la main
    // au téléviseur que de fabriquer une adresse fausse.
    if (!nextOne || nextOne.startsWith("#")) return null;
    return nextOne;
  }
  return null;
}

/** L'URL est-elle un manifeste maître, seul cas où il y a un choix à faire ? */
export function isMasterManifest(url: string): boolean {
  return url.includes("master.m3u8");
}

/**
 * Rend absolue l'URL d'une variante, à partir de celle du manifeste.
 *
 * `page` est indispensable et c'est le piège qui a coûté le plus de temps ici :
 * le client parle au proxy par un chemin RELATIF (`/api/jellyfin/…`), parce que
 * `JellyfinClient` est construit sur cette base. Une balise `<video>` le résout
 * seule contre l'origine du document ; `new URL` ne le fait pas et lève
 * « Invalid base URL ». Il faut donc rendre la base absolue d'abord.
 */
export function absoluteVariantUrl(relative: string, master: string, page: string): string | null {
  try {
    return new URL(relative, new URL(master, page)).toString();
  } catch {
    return null;
  }
}

/**
 * Résout le manifeste maître en URL de sa variante Dolby Vision.
 *
 * Rend `null` dès que quoi que ce soit cloche — pas de variante, manifeste
 * illisible, réseau en défaut. L'appelant repart alors sur le manifeste maître,
 * c'est-à-dire sur le comportement d'avant : dégradé, jamais cassé.
 */
export async function resolveDoviVariant(
  master: string,
  page: string = window.location.href,
): Promise<string | null> {
  try {
    const response = await fetch(master);
    if (!response.ok) return null;
    const relative = doviVariantLine(await response.text());
    if (!relative) return null;
    // Les URL du manifeste sont relatives à celle du manifeste lui-même, dont
    // la chaîne de requête ne doit pas être héritée.
    return absoluteVariantUrl(relative, master, page);
  } catch {
    return null;
  }
}
