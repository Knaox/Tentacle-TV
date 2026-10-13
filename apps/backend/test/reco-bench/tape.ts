/**
 * La BANDE TMDB du banc : chaque GET passé par `tmdbFetch` est rangé dans
 * `data/reco-bench/tmdb-tape/` (hors dépôt) et rejoué ensuite, octet pour
 * octet. Mode `auto` : rejoue ce qui est enregistré, enregistre le reste (clé
 * TMDB de la base) ; mode `offline` : rien ne sort, une réponse absente vaut
 * une erreur (le moteur la traite comme un TMDB muet). La clé d'API n'est
 * jamais dans les paramètres enregistrés.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTmdbTransport } from "../../src/services/tmdb/client";

export type TapeMode = "auto" | "offline";

export interface TapeStats {
  replayed: number;
  recorded: number;
  missing: number;
}

export function installTape(dir: string, mode: TapeMode): TapeStats {
  mkdirSync(dir, { recursive: true });
  const stats: TapeStats = { replayed: 0, recorded: 0, missing: 0 };
  setTmdbTransport(async <T>(path: string, params: Record<string, string>, network: () => Promise<T>): Promise<T> => {
    const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
    const key = `${path}?${sorted}`;
    const file = join(dir, `${createHash("sha1").update(key).digest("hex")}.json`);
    if (existsSync(file)) {
      stats.replayed++;
      return (JSON.parse(readFileSync(file, "utf8")) as { body: T }).body;
    }
    if (mode === "offline") {
      stats.missing++;
      throw new Error(`bande TMDB : réponse absente (${path})`);
    }
    const body = await network();
    writeFileSync(file, JSON.stringify({ key, body }));
    stats.recorded++;
    return body;
  });
  return stats;
}
