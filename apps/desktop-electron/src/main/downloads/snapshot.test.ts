/**
 * Le snapshot est ce qui rend une fiche présentable hors ligne. Il est
 * best-effort de bout en bout — donc silencieux quand il échoue, et c'est
 * exactement pour ça qu'il se teste : un réseau injecté permet de vérifier ce
 * qu'il demande, ce qu'il écrit, et ce qu'il fait d'une source muette.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openInMemory } from "./db";
import * as episodeNumbers from "./episodeNumbers";
import type { FetchBytes } from "./fetcher";
import { getSpec, metaVersion, snapshotExists, upsertItemMeta, type MetaSpec } from "./meta";
import { ensureLayout } from "./paths";
import { snapshot } from "./snapshot";
import { parseSpecs, sanitizeTag, subtitleRelPath } from "./subs";
import { pickWidth, tileCount, type TrickplayInfo } from "./trickplay";

const dossiers: string[] = [];

function racinePreparee(): string {
  const root = mkdtempSync(path.join(tmpdir(), "tentacle-snap-"));
  dossiers.push(root);
  ensureLayout(root);
  return root;
}

afterEach(() => {
  while (dossiers.length > 0) {
    const dir = dossiers.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

function octets(texte: string): Uint8Array {
  return new Uint8Array(Buffer.from(texte, "utf8"));
}

/** Réseau simulé : une carte URL → réponse, et le journal des URL demandées. */
function reseau(reponses: Record<string, string>): { fetchBytes: FetchBytes; vues: string[] } {
  const vues: string[] = [];
  const fetchBytes: FetchBytes = async (url) => {
    vues.push(url);
    for (const [motif, corps] of Object.entries(reponses)) {
      if (url.includes(motif)) return octets(corps);
    }
    return null;
  };
  return { fetchBytes, vues };
}

function specEpisode(): MetaSpec {
  return {
    itemId: "ep1",
    kind: "episode",
    seriesId: "serie1",
    seasonId: "saison1",
    libraryId: null,
    runtimeTicks: null,
    title: "Un episode",
    seriesName: "Une serie",
    indexNumber: null,
    parentIndexNumber: null,
  };
}

describe("snapshot", () => {
  it("ecrit les DTO, pose les numeros et la bibliotheque", async () => {
    const db = openInMemory();
    const root = racinePreparee();
    upsertItemMeta(db, specEpisode(), 1_000);
    const { fetchBytes, vues } = reseau({
      "/Items/ep1?fields=": '{"Name":"Un episode","IndexNumber":4,"ParentIndexNumber":2}',
      "/Items/serie1": '{"Name":"Une serie"}',
      "/Items/saison1": '{"Name":"Saison 2"}',
      "/Ancestors": '[{"Type":"Season","Id":"s"},{"Type":"CollectionFolder","Id":"lib-42"}]',
    });

    await snapshot(fetchBytes, db, "https://tv.exemple", root, specEpisode(), 2_000);

    expect(snapshotExists(root, "ep1")).toBe(true);
    expect(existsSync(path.join(root, "meta", "ep1", "series.json"))).toBe(true);
    expect(existsSync(path.join(root, "meta", "ep1", "season.json"))).toBe(true);
    // Le DTO fait autorite sur les numeros.
    const spec = getSpec(db, "ep1");
    expect(spec?.indexNumber).toBe(4);
    expect(spec?.parentIndexNumber).toBe(2);
    expect(spec?.libraryId).toBe("lib-42");
    expect(metaVersion(db, "ep1")).toBe(2);
    // Le jeton ne part JAMAIS en query.
    expect(vues.every((u) => !u.includes("token") && !u.includes("api_key"))).toBe(true);
  });

  it("un serveur entierement muet ne fait pas echouer le snapshot", async () => {
    const db = openInMemory();
    const root = racinePreparee();
    upsertItemMeta(db, specEpisode(), 1_000);
    const { fetchBytes } = reseau({});

    await expect(
      snapshot(fetchBytes, db, "https://tv.exemple", root, specEpisode(), 2_000),
    ).resolves.toBeUndefined();

    // La version est posee quand meme : la reparation reprendra le reste.
    expect(metaVersion(db, "ep1")).toBe(2);
    expect(snapshotExists(root, "ep1")).toBe(false);
  });

  it("un film ne demande ni serie, ni saison, ni segments de greffon", async () => {
    const db = openInMemory();
    const root = racinePreparee();
    const film: MetaSpec = { ...specEpisode(), itemId: "f1", kind: "movie", seriesId: null, seasonId: null };
    upsertItemMeta(db, film, 1_000);
    const { fetchBytes, vues } = reseau({ "/Items/f1?fields=": '{"Name":"Un film"}' });

    await snapshot(fetchBytes, db, "https://tv.exemple", root, film, 2_000);

    expect(vues.some((u) => u.includes("IntroSkipperSegments"))).toBe(false);
    expect(vues.some((u) => u.includes("series-primary"))).toBe(false);
  });

  it("le resume dit ce qui a reussi", async () => {
    const db = openInMemory();
    const root = racinePreparee();
    upsertItemMeta(db, specEpisode(), 1_000);
    const { fetchBytes } = reseau({ "/Items/ep1?fields=": '{"Name":"Un episode"}' });

    await snapshot(fetchBytes, db, "https://tv.exemple", root, specEpisode(), 2_000);

    const row = db.prepare("SELECT images_state FROM item_meta WHERE item_id = 'ep1'").get();
    expect(String(row?.["images_state"])).toContain("item");
  });
});

describe("numeros d'episode", () => {
  it("le rattrapage lit les snapshots du disque", () => {
    const db = openInMemory();
    const root = racinePreparee();
    upsertItemMeta(db, specEpisode(), 1_000);
    mkdirSync(path.join(root, "meta", "ep1"), { recursive: true });
    writeFileSync(path.join(root, "meta", "ep1", "item.json"), '{"IndexNumber":4,"ParentIndexNumber":2}');

    expect(episodeNumbers.backfill(db, root)).toBe(1);
    expect(getSpec(db, "ep1")?.indexNumber).toBe(4);
    // Idempotent : plus rien a rattraper au second passage.
    expect(episodeNumbers.backfill(db, root)).toBe(0);
  });

  it("un JSON casse laisse les numeros nuls", () => {
    const db = openInMemory();
    expect(episodeNumbers.apply(db, "ep1", octets("{ pas du json"))).toBe(false);
  });

  it("les films sont ignores", () => {
    const db = openInMemory();
    expect(episodeNumbers.apply(db, "f1", octets('{"Name":"Un film"}'))).toBe(false);
  });

  it("un re-upsert sans numeros les conserve", () => {
    const db = openInMemory();
    upsertItemMeta(db, { ...specEpisode(), indexNumber: 7, parentIndexNumber: 3 }, 1_000);
    upsertItemMeta(db, specEpisode(), 2_000);
    expect(getSpec(db, "ep1")?.indexNumber).toBe(7);
  });
});

describe("sous-titres", () => {
  it("l'etiquette est nettoyee avant d'entrer dans un nom de fichier", () => {
    expect(sanitizeTag("fre-forced")).toBe("fre-forced");
    expect(sanitizeTag("../evil/FR")).toBe("evilfr");
    expect(sanitizeTag("")).toBe("und");
    expect(sanitizeTag("x".repeat(100)).length).toBeLessThanOrEqual(40);
  });

  it("le chemin d'un side-car reste confine", () => {
    expect(subtitleRelPath("i1", { index: 3, format: "srt", langTag: "../fre" })).toBe(
      "media/i1/subs/3-fre.srt",
    );
  });

  it("la liste stockee tolere un JSON abime", () => {
    expect(parseSpecs("pas du json")).toEqual([]);
    expect(parseSpecs('[{"index":3,"format":"srt","langTag":"fre"}]')).toEqual([
      { index: 3, format: "srt", langTag: "fre" },
    ]);
    // Une entree incomplete est sautee, pas fatale.
    expect(parseSpecs('[{"format":"srt"},{"index":1,"format":"vtt","langTag":"eng"}]')).toHaveLength(1);
  });
});

describe("trickplay", () => {
  const info: TrickplayInfo = {
    Width: 320,
    Height: 180,
    TileWidth: 10,
    TileHeight: 10,
    ThumbnailCount: 720,
    Interval: 10_000,
  };

  it("le nombre de planches est arrondi au superieur", () => {
    expect(tileCount(info)).toBe(8); // ceil(720 / 100)
    expect(tileCount({ ...info, ThumbnailCount: 100 })).toBe(1);
    expect(tileCount({ ...info, ThumbnailCount: 101 })).toBe(2);
  });

  it("la largeur choisie est la plus proche de 320", () => {
    const manifest = {
      "msrc-A": {
        "160": { ...info, Width: 160, Height: 90 },
        "320": info,
      },
    };
    expect(pickWidth(manifest, "msrc-A")?.width).toBe(320);
    // Source absente : repli sur la premiere.
    expect(pickWidth(manifest, "inconnu")?.mediaSourceId).toBe("msrc-A");
  });

  it("un manifeste vide ou aberrant ne rend rien", () => {
    expect(pickWidth({}, "msrc-A")).toBeNull();
    expect(pickWidth(null, "msrc-A")).toBeNull();
    // TileWidth nul : division par zero evitee en amont.
    expect(pickWidth({ a: { "320": { ...info, TileWidth: 0 } } }, "a")).toBeNull();
  });
});

describe("segments", () => {
  it("une source qui ne rend pas du JSON devient null, pas un fichier casse", async () => {
    const db = openInMemory();
    const root = racinePreparee();
    upsertItemMeta(db, specEpisode(), 1_000);
    // Le greffon absent rend une page d'erreur HTML : l'ecrire telle quelle
    // casserait segments.json au moment de le relire.
    const { fetchBytes } = reseau({
      "/Items/ep1?fields=": "{}",
      "/MediaSegments/": '[{"Type":"Intro"}]',
      "/IntroSkipperSegments": "<html>404</html>",
    });

    await snapshot(fetchBytes, db, "https://tv.exemple", root, specEpisode(), 2_000);

    const brut = readFileSync(path.join(root, "meta", "ep1", "segments.json"), "utf8");
    const parsed = JSON.parse(brut) as { mediaSegments: unknown; pluginDict: unknown };
    expect(parsed.mediaSegments).toEqual([{ Type: "Intro" }]);
    expect(parsed.pluginDict).toBeNull();
  });
});
