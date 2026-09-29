/**
 * Le disque du serveur, réchauffé AVANT le clic — `media_warm`.
 *
 * # Ce que coûte un titre que le serveur n'a jamais lu (29.09.2026)
 *
 * Une fois la sortie vidéo de mpv prête d'avance (`videoPrewarm.ts`), l'attente
 * d'un titre neuf est celle du disque du serveur : Jellyfin lit ses fichiers
 * sur un NAS, et un MKV s'ouvre en trois lectures — la tête (en-têtes), puis
 * l'index en FIN de fichier (Cues, Tags), puis le premier bloc. Mesuré sur des
 * titres jamais lus : premier octet 55-365 ms, index 95-410 ms, soit 300 ms à
 * 1 s d'ouverture ; les mêmes titres une fois lus s'ouvrent en 35-80 ms.
 *
 * La page (fiche ouverte, survol d'une carte) demande donc la lecture de la
 * tête et de la fin du fichier que « Lire » jouerait : le serveur les lit en
 * répondant, et les garde en cache pour mpv. Aucun octet n'est gardé ici.
 *
 * # Pourquoi ici et pas dans la page
 *
 * Depuis la page, une requête vers le Jellyfin direct est soumise au CORS — et
 * un `Range` écarté en mode opaque ferait télécharger le fichier ENTIER. Ici,
 * le statut se lit : tout autre chose qu'un 206 est coupé sur-le-champ.
 *
 * # Ce qui est refusé
 *
 * Tout ce qui n'est pas un flux de lecture (`/Videos/<id>/stream`), plus de
 * deux plages, une plage de plus de 4 Mio. Le reste est borné : une même
 * demande n'est rejouée qu'après dix minutes, deux au plus sont en vol, et une
 * lecture qui traîne est abandonnée.
 */

import { z } from "zod";
import { trace } from "../video/native";
import type { CommandRegistry } from "./registry";

/** Une plage `[début, fin]` en octets, bornes comprises. */
type Range = readonly [number, number];

export const MAX_RANGE_BYTES = 4 * 1024 * 1024;
const MAX_IN_FLIGHT = 2;
const REPLAY_AFTER_MS = 10 * 60_000;
const TIMEOUT_MS = 15_000;

const STREAM_PATH = /\/Videos\/[0-9a-f]{32}\/stream$/i;

/** Pure : le motif du refus, ou `null`. */
export function refuseWarm(url: string, ranges: readonly Range[]): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "URL illisible";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "protocole refusé";
  if (!STREAM_PATH.test(parsed.pathname)) return "pas un flux de lecture";
  if (ranges.length === 0 || ranges.length > 2) return "une ou deux plages";
  for (const [start, end] of ranges) {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
      return "plage invalide";
    }
    if (end - start + 1 > MAX_RANGE_BYTES) return "plage trop longue";
  }
  return null;
}

/** L'identifiant du titre, seul nom qui entre au journal — l'URL porte un jeton. */
function itemOf(url: string): string {
  return /\/Videos\/([0-9a-f]{32})\//i.exec(url)?.[1]?.slice(0, 8) ?? "?";
}

export interface WarmDeps {
  fetch: typeof fetch;
  now: () => number;
}

/** Une file bornée : dédoublonnage, deux lectures en vol, le reste écarté. */
export class MediaWarmer {
  private readonly recent = new Map<string, number>();
  private inFlight = 0;

  constructor(private readonly deps: WarmDeps = { fetch, now: Date.now }) {}

  /** Rend `false` quand la demande est écartée (déjà faite, ou file pleine). */
  warm(url: string, ranges: readonly Range[]): boolean {
    const key = `${url}#${ranges.map((r) => r.join("-")).join(",")}`;
    const now = this.deps.now();
    const last = this.recent.get(key);
    if (last !== undefined && now - last < REPLAY_AFTER_MS) return false;
    if (this.inFlight >= MAX_IN_FLIGHT) return false;
    this.recent.set(key, now);
    for (const [k, at] of this.recent) if (now - at >= REPLAY_AFTER_MS) this.recent.delete(k);
    this.inFlight += 1;
    void this.read(url, ranges).finally(() => {
      this.inFlight -= 1;
    });
    return true;
  }

  private async read(url: string, ranges: readonly Range[]): Promise<void> {
    const started = this.deps.now();
    const results = await Promise.all(ranges.map((range) => this.readRange(url, range)));
    trace(`préchargement ${itemOf(url)} : ${results.join(" · ")} en ${String(this.deps.now() - started)} ms`);
  }

  private async readRange(url: string, [start, end]: Range): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await this.deps.fetch(url, {
        headers: { Range: `bytes=${String(start)}-${String(end)}` },
        signal: controller.signal,
      });
      // Tout sauf un 206, c'est le fichier entier qui arriverait : on coupe.
      if (res.status !== 206 || res.body === null) {
        controller.abort();
        return `refusé (${String(res.status)})`;
      }
      let bytes = 0;
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
      }
      return `${String(Math.round(bytes / 1024))} Kio`;
    } catch {
      return "abandonné";
    } finally {
      clearTimeout(timer);
    }
  }
}

const RANGE = z.tuple([z.number().int(), z.number().int()]);
const WARM = z.object({ url: z.string(), ranges: z.array(RANGE) });

export function registerMediaWarmCommands(registry: CommandRegistry): void {
  const warmer = new MediaWarmer();
  registry.add("media_warm", {
    schema: WARM,
    run: ({ url, ranges }) => {
      const refusal = refuseWarm(url, ranges);
      if (refusal !== null) throw new Error(`media_warm : ${refusal}`);
      return warmer.warm(url, ranges) ? "en cours" : "écarté";
    },
  });
}
