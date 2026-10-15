/**
 * L'ORACLE des titres extérieurs : le banc relit lui-même chez TMDB la
 * classification d'un titre que Tentacle (ou Vigie) montre au compte restreint,
 * sans passer par le code du cœur. Règle volontairement simple et stricte, pour
 * une note maximale de 6 ans : classification française (table VIVANTE du
 * Jellyfin du banc, ou un âge écrit) sinon américaine (`G`, `TV-Y`, `TV-G` = 0 ;
 * tout le reste dépasse 6) ; une série sans l'une ni l'autre prend la plus
 * stricte des autres pays ; `adult` ou aucune classification = refusé.
 * Un titre que l'oracle refuse et que Tentacle montre est une fuite.
 */

import type { JellyfinBench } from "./jellyfinBench";

export type MediaType = "movie" | "tv";

export interface OracleVerdict {
  allowed: boolean;
  why: string;
}

const US_ZERO = new Set(["G", "TV-Y", "TV-G"]);
const US_KNOWN = new Set(["G", "PG", "PG-13", "R", "NC-17", "TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14", "TV-MA"]);

export class ExternalOracle {
  private readonly cache = new Map<string, Promise<OracleVerdict>>();

  private constructor(private readonly tmdbKey: string, private readonly frTable: Map<string, number>, private readonly max: number) {}

  static async create(jf: JellyfinBench, tmdbKey: string, max: number): Promise<ExternalOracle> {
    const ratings = (await jf.http.get<Array<{ Name: string; Value?: number }>>("/Localization/ParentalRatings", jf.admin.token)) ?? [];
    const table = new Map(ratings.filter((r) => typeof r.Value === "number").map((r) => [r.Name.toLowerCase(), r.Value as number]));
    return new ExternalOracle(tmdbKey, table, max);
  }

  /** Un âge écrit (« 12 », « -12 », « 12+ ») ou une entrée de la table française. */
  private frScore(cert: string): number | null {
    const known = this.frTable.get(cert.toLowerCase());
    if (known !== undefined) return known;
    const age = /^-?(\d{1,2})\+?$/.exec(cert.trim());
    return age ? Number(age[1]) : null;
  }

  private usScore(cert: string): number | null {
    if (US_ZERO.has(cert)) return 0;
    return US_KNOWN.has(cert) ? this.max + 1 : null;
  }

  private judge(certs: Map<string, string[]>, mediaType: MediaType): OracleVerdict {
    const strictest = (list: Array<number | null>): number | null => (list.some((s) => s === null) || list.length === 0 ? null : Math.max(...(list as number[])));
    const verdict = (score: number | null, from: string): OracleVerdict =>
      score === null ? { allowed: false, why: `${from} illisible` } : { allowed: score <= this.max, why: `${from} → ${score}` };
    const fr = certs.get("FR");
    if (fr?.length) return verdict(strictest(fr.map((c) => this.frScore(c))), `FR « ${fr.join(", ")} »`);
    const us = certs.get("US");
    if (us?.length) return verdict(strictest(us.map((c) => this.usScore(c))), `US « ${us.join(", ")} »`);
    if (mediaType === "tv" && certs.size > 0) {
      const others = [...certs.values()].flat();
      return verdict(strictest(others.map((c) => this.frScore(c))), `autres pays « ${others.slice(0, 4).join(", ")} »`);
    }
    return { allowed: false, why: "aucune classification" };
  }

  private async read(mediaType: MediaType, tmdbId: number): Promise<OracleVerdict> {
    const append = mediaType === "movie" ? "release_dates" : "content_ratings";
    const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${this.tmdbKey}&append_to_response=${append}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { allowed: false, why: `TMDB ${res.status}` };
    const body = (await res.json()) as {
      adult?: boolean;
      release_dates?: { results?: Array<{ iso_3166_1: string; release_dates: Array<{ certification?: string }> }> };
      content_ratings?: { results?: Array<{ iso_3166_1: string; rating?: string }> };
    };
    if (body.adult) return { allowed: false, why: "adult" };
    const certs = new Map<string, string[]>();
    const add = (country: string, cert: string | undefined) => {
      if (!cert?.trim()) return;
      certs.set(country, [...(certs.get(country) ?? []), cert.trim()]);
    };
    for (const r of body.release_dates?.results ?? []) for (const d of r.release_dates) add(r.iso_3166_1, d.certification);
    for (const r of body.content_ratings?.results ?? []) add(r.iso_3166_1, r.rating);
    return this.judge(certs, mediaType);
  }

  verdict(mediaType: MediaType, tmdbId: number): Promise<OracleVerdict> {
    const key = `${mediaType}:${tmdbId}`;
    let pending = this.cache.get(key);
    if (!pending) {
      pending = this.read(mediaType, tmdbId).catch((error: unknown) => ({ allowed: false, why: `lecture impossible (${String(error)})` }));
      this.cache.set(key, pending);
    }
    return pending;
  }
}

/** Les titres extérieurs d'une réponse, où qu'ils soient : `{ tmdbId, mediaType }`, `key: "movie:…"`, ou une carte Jellyseerr `{ id, mediaType }`. */
export function externalTitlesIn(json: unknown): Array<{ mediaType: MediaType; tmdbId: number }> {
  const found = new Map<string, { mediaType: MediaType; tmdbId: number }>();
  const add = (type: unknown, id: unknown) => {
    const mediaType = type === "series" ? "tv" : type;
    const tmdbId = typeof id === "string" ? Number(id) : id;
    if ((mediaType === "movie" || mediaType === "tv") && Number.isInteger(tmdbId) && (tmdbId as number) > 0) {
      found.set(`${mediaType}:${tmdbId}`, { mediaType, tmdbId: tmdbId as number });
    }
  };
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    if ("tmdbId" in o) add(o.mediaType ?? o.type, o.tmdbId);
    else if ("mediaType" in o && "id" in o) add(o.mediaType, o.id);
    if (typeof o.key === "string") {
      const m = /^(movie|tv):(\d+)$/.exec(o.key);
      if (m) add(m[1], m[2]);
    }
    for (const value of Object.values(o)) walk(value);
  };
  walk(json);
  return [...found.values()];
}
