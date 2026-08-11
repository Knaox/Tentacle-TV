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
export type GenreFlux = "segment" | "manifeste" | "flux" | "image" | "api";

/**
 * À quoi sert un chemin proxy.
 *
 * Le découpage suit ce que le lecteur en fait, non ce que Jellyfin en pense :
 * un segment et son manifeste empruntent la même route `hls1/`, mais l'un se
 * demande mille fois par film et l'autre trois.
 */
export function genreDeChemin(chemin: string): GenreFlux {
  if (/\/hls1\//.test(chemin)) return chemin.endsWith(".m3u8") ? "manifeste" : "segment";
  if (/\.m3u8$/.test(chemin)) return "manifeste";
  if (/^(Videos|Audio)\/.*\/(stream|universal)/.test(chemin)) return "flux";
  if (/\/Images\//.test(chemin) || /^Items\/.*\/Images/.test(chemin)) return "image";
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
export function raisonCoupure(err: unknown): string {
  const direct = verdictParNom(err);
  if (direct) return direct;

  const cause = (err as { cause?: unknown } | null | undefined)?.cause;
  const indirect = verdictParNom(cause);
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
function verdictParNom(e: unknown): string | null {
  if (!(e instanceof Error) && !(e instanceof DOMException)) return null;
  if (e.name === "TimeoutError") return "delai-absolu";
  if (e.name === "AbortError") return "annule";
  return null;
}

export interface EntreeFlux {
  chemin: string;
  methode: string;
  /** Millisecondes écoulées depuis le départ de la requête vers Jellyfin. */
  ms: number;
  statut?: number;
  /** `content-length` annoncé par Jellyfin — un corps plus court est tronqué. */
  attendus?: number | null;
  cause?: string;
  /** Le client est parti avant la fin : ce n'est pas une panne. */
  annule?: boolean;
}

/** Une ligne de journal exploitable par `jq`, sans champ vide. */
export function ligneFlux(e: EntreeFlux): Record<string, unknown> {
  const ligne: Record<string, unknown> = {
    evt: "flux",
    genre: genreDeChemin(e.chemin),
    chemin: e.chemin,
    methode: e.methode,
    ms: Math.round(e.ms),
  };
  if (e.statut !== undefined) ligne.statut = e.statut;
  if (e.attendus !== undefined && e.attendus !== null) ligne.attendus = e.attendus;
  if (e.cause) ligne.cause = e.cause;
  if (e.annule) ligne.annule = true;
  return ligne;
}

/**
 * Le suivi des flux NORMAUX est coûteux à lire, pas à écrire : un film de deux
 * heures fait plus de mille segments. On ne l'allume que pour une campagne de
 * mesure, jamais en production.
 */
export function suiviFluxActif(): boolean {
  return process.env.TENTACLE_JOURNAL_FLUX === "1";
}
