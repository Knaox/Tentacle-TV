/**
 * Ce que le proxy dit quand un flux se coupe.
 *
 * # Pourquoi ce fichier existe
 *
 * Le téléviseur webOS lit le HLS avec la pile média de LG, qui n'a AUCUNE
 * politique de réessai : une requête de segment ratée devient un
 * `MEDIA_ERR_NETWORK` définitif, et la lecture se fige. Il fallait donc savoir
 * ce que le proxy avait répondu à ce moment-là. Or il ne disait rien :
 *
 * - la branche 504 rendait son code sans écrire une ligne ;
 * - la branche 502 journalisait `err.message`, et `undici.fetch` enveloppe
 *   TOUTES ses erreurs de transport dans un `TypeError: fetch failed` dont la
 *   vraie cause est rangée dans `err.cause`. Un délai d'en-têtes dépassé
 *   s'écrivait donc « fetch failed », exactement comme une connexion refusée ;
 * - une coupure survenue APRÈS `reply.send(flux)` ne passait dans aucun
 *   `catch` : le corps s'arrêtait en silence, et le client recevait moins
 *   d'octets que le `content-length` qu'on venait de lui annoncer.
 *
 * Autrement dit, l'hypothèse principale du gel n'était pas observable — même
 * si elle se produisait à chaque saut. Ces trois fonctions la rendent lisible.
 */

/** Famille de chemin, pour trier un journal de plusieurs milliers de lignes. */
export type StreamKind = "segment" | "manifeste" | "flux" | "image" | "api";

/**
 * À quoi sert un chemin proxy.
 *
 * Le découpage suit ce que le lecteur en fait, non ce que Jellyfin en pense :
 * un segment et son manifeste empruntent la même route `hls1/`, mais l'un se
 * demande mille fois par film et l'autre trois.
 */
export function kindFromPath(path: string): StreamKind {
  if (/\/hls1\//.test(path)) return path.endsWith(".m3u8") ? "manifeste" : "segment";
  if (/\.m3u8$/.test(path)) return "manifeste";
  if (/^(Videos|Audio)\/.*\/(stream|universal)/.test(path)) return "flux";
  if (/\/Images\//.test(path) || /^Items\/.*\/Images/.test(path)) return "image";
  return "api";
}

/**
 * La cause réelle d'une coupure, en un mot.
 *
 * `undici` range la sienne dans `err.cause.code` : `UND_ERR_HEADERS_TIMEOUT`
 * (l'amont n'a pas répondu à temps — c'est le cas quand Jellyfin retient les
 * en-têtes d'un segment tant que ffmpeg ne l'a pas produit),
 * `UND_ERR_BODY_TIMEOUT`, `UND_ERR_SOCKET`, `ECONNRESET`, `ECONNREFUSED`.
 * Distinguer ces cas est tout l'intérêt : ils appellent des remèdes opposés.
 */
export function cutoffReason(err: unknown): string {
  const direct = verdictByName(err);
  if (direct) return direct;

  const cause = (err as { cause?: unknown } | null | undefined)?.cause;
  const indirect = verdictByName(cause);
  if (indirect) return indirect;

  if (typeof cause === "object" && cause !== null && "code" in cause) {
    const code = (cause as { code?: unknown }).code;
    if (typeof code === "string" && code) return code;
  }
  if (cause instanceof Error && cause.message) return cause.message;
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}

/** Les deux annulations que Node nomme lui-même, à ne surtout pas confondre. */
function verdictByName(e: unknown): string | null {
  if (!(e instanceof Error) && !(e instanceof DOMException)) return null;
  if (e.name === "TimeoutError") return "delai-absolu";
  if (e.name === "AbortError") return "annule";
  return null;
}

/**
 * Une ligne de journal, champ par champ.
 *
 * ⚠️ Ces noms de champs SONT le format du journal : ils ressortent tels quels
 * dans le JSON que `jq` filtre, et le relevé de la dalle
 * (`apps/tv-webos/scripts/releveLecture.mjs`) émet les mêmes clés pour qu'on
 * puisse recouper les deux. Ils restent donc en français, comme le reste du
 * format — les traduire changerait la sortie, pas seulement du code.
 */
export interface StreamEntry {
  chemin: string;
  methode: string;
  /** Millisecondes écoulées depuis le départ de la requête vers Jellyfin. */
  ms: number;
  statut?: number;
  /** `content-length` annoncé par Jellyfin — un corps plus court est tronqué. */
  attendus?: number | null;
  /**
   * L'en-tête `Range` du client. Décisif sur un téléviseur : un lecteur qui
   * redemande le même segment SANS plage recommence à zéro à chaque fois et ne
   * progresse jamais ; avec plage, il avance.
   */
  plage?: string | null;
  cause?: string;
  /** Le client est parti avant la fin : ce n'est pas une panne. */
  annule?: boolean;
  /**
   * Octets réellement écrits vers le client.
   *
   * Le chiffre qui manquait. `attendus` ne dit que ce que Jellyfin a ANNONCÉ ;
   * seul celui-ci dit où le lecteur a lâché. Sur la dalle, un téléviseur qui
   * abandonne un segment de 9,6 Mo au bout de quarante millisecondes n'a pas eu
   * un problème de débit — il a lu l'en-tête du fragment et refermé.
   */
  octets?: number | null;
  /** Millisecondes entre l'arrivée des en-têtes et le dernier octet écrit. */
  msCorps?: number;
}

/**
 * Débit effectif d'un transfert, en mégabits par seconde.
 *
 * `null` sur des valeurs qui ne veulent rien dire plutôt que `Infinity` ou
 * `NaN` : une ligne de journal sans débit se lit, une ligne qui en annonce un
 * faux se croit.
 */
export function throughputMbps(bytes: number | null | undefined, ms: number | undefined): number | null {
  if (!bytes || !ms || bytes <= 0 || ms <= 0) return null;
  return Math.round(((bytes * 8) / (ms / 1000) / 1e6) * 100) / 100;
}

/** Une ligne de journal exploitable par `jq`, sans champ vide. */
export function streamLine(e: StreamEntry): Record<string, unknown> {
  const line: Record<string, unknown> = {
    evt: "flux",
    genre: kindFromPath(e.chemin),
    chemin: e.chemin,
    methode: e.methode,
    ms: Math.round(e.ms),
  };
  if (e.statut !== undefined) line.statut = e.statut;
  if (e.attendus !== undefined && e.attendus !== null) line.attendus = e.attendus;
  if (e.octets !== undefined && e.octets !== null) line.octets = e.octets;
  if (e.msCorps !== undefined) line.msCorps = Math.round(e.msCorps);
  const mbps = throughputMbps(e.octets, e.msCorps);
  if (mbps !== null) line.debitMbps = mbps;
  if (e.plage) line.plage = e.plage;
  if (e.cause) line.cause = e.cause;
  if (e.annule) line.annule = true;
  return line;
}

/**
 * Le suivi des flux NORMAUX est coûteux à lire, pas à écrire : un film de deux
 * heures fait plus de mille segments. On ne l'allume que pour une campagne de
 * mesure, jamais en production.
 */
export function streamTrackingEnabled(): boolean {
  return process.env.TENTACLE_JOURNAL_FLUX === "1";
}
