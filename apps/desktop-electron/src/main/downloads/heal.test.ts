/**
 * La réparation tourne à CHAQUE démarrage, sur tout ce qui est complet. Ce
 * qu'elle demande au réseau se paye donc à chaque lancement, et c'est ça qu'on
 * mesure ici : le journal des URL vues, pas seulement le résultat.
 */

import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { openInMemory } from "./db";
import type { FetchBytes } from "./fetcher";
import { heal } from "./heal";
import { markSnapshotDone, saveBytes, upsertItemMeta, type MetaSpec } from "./meta";
import { claimOrCreateFile } from "./store";
import { setStatus } from "./queue";
import { markNone, noneRecently, RECONTROLE_APRES_MS } from "./trickplay";
import { racinePreparee, spec } from "./testkit";

const SERVEUR = "https://tv.exemple";

function film(itemId: string): MetaSpec {
  return {
    itemId,
    kind: "movie",
    seriesId: null,
    seasonId: null,
    libraryId: null,
    runtimeTicks: null,
    title: "Un film",
    seriesName: null,
    indexNumber: null,
    parentIndexNumber: null,
  };
}

/** Réseau simulé : journal des URL, réponses par motif. */
function reseau(reponses: Record<string, string> = {}): {
  fetchBytes: FetchBytes;
  vues: string[];
} {
  const vues: string[] = [];
  const fetchBytes: FetchBytes = async (url) => {
    vues.push(url);
    for (const [motif, corps] of Object.entries(reponses)) {
      if (url.includes(motif)) return new Uint8Array(Buffer.from(corps, "utf8"));
    }
    return null;
  };
  return { fetchBytes, vues };
}

/**
 * Un item complet dont le snapshot est À JOUR : sans ça la réparation le
 * refait, et son trafic couvrirait celui qu'on vient observer.
 */
function itemComplet(db: DatabaseSync, root: string, itemId: string): void {
  upsertItemMeta(db, film(itemId), 1_000);
  const claim = claimOrCreateFile(db, spec({ itemId, relPath: `media/${itemId}/original-ms1.mkv` }));
  setStatus(db, claim.fileId, "complete", null, 1_000);
  saveBytes(root, `meta/${itemId}/item.json`, new Uint8Array(Buffer.from("{}", "utf8")));
  markSnapshotDone(db, itemId, "{}", 1_000);
}

describe("reparation", () => {
  it("un item sans trickplay n'est demande qu'UNE fois, pas a chaque demarrage", async () => {
    const db = openInMemory();
    const root = racinePreparee("tentacle-heal-");
    itemComplet(db, root, "f1");

    // Le serveur répond, mais son DTO ne porte aucun Trickplay.
    const premier = reseau({ "/Items/f1?fields=Trickplay": '{"Name":"Un film"}' });
    await heal(premier.fetchBytes, db, SERVEUR, root, 10_000);
    expect(premier.vues.filter((u) => u.includes("fields=Trickplay"))).toHaveLength(1);
    expect(noneRecently(root, "f1", 10_000)).toBe(true);

    // Second démarrage, le lendemain : plus rien ne part.
    const second = reseau({ "/Items/f1?fields=Trickplay": '{"Name":"Un film"}' });
    await heal(second.fetchBytes, db, SERVEUR, root, 10_000 + 24 * 3_600_000);
    expect(second.vues).toHaveLength(0);
  });

  it("le marqueur perime : la bibliotheque a pu se mettre a generer des planches", async () => {
    const db = openInMemory();
    const root = racinePreparee("tentacle-heal-");
    itemComplet(db, root, "f1");
    markNone(root, "f1", 0);

    const tard = reseau({ "/Items/f1?fields=Trickplay": '{"Name":"Un film"}' });
    await heal(tard.fetchBytes, db, SERVEUR, root, RECONTROLE_APRES_MS + 1);

    expect(tard.vues.filter((u) => u.includes("fields=Trickplay"))).toHaveLength(1);
  });

  it("un serveur injoignable ne pose PAS le marqueur", async () => {
    const db = openInMemory();
    const root = racinePreparee("tentacle-heal-");
    itemComplet(db, root, "f1");

    // Rien ne répond : c'est du réseau, pas un verdict sur l'item.
    const muet = reseau();
    await heal(muet.fetchBytes, db, SERVEUR, root, 10_000);

    expect(noneRecently(root, "f1", 10_000)).toBe(false);
    // Donc le démarrage suivant redemande, comme il se doit.
    const retour = reseau({ "/Items/f1?fields=Trickplay": '{"Name":"Un film"}' });
    await heal(retour.fetchBytes, db, SERVEUR, root, 20_000);
    expect(retour.vues.filter((u) => u.includes("fields=Trickplay"))).toHaveLength(1);
  });

  it("ne lit que les fichiers COMPLETS", async () => {
    const db = openInMemory();
    const root = racinePreparee("tentacle-heal-");
    itemComplet(db, root, "f1");
    // Un second item, en cours de transfert : la réparation l'ignore.
    upsertItemMeta(db, film("f2"), 1_000);
    claimOrCreateFile(db, spec({ itemId: "f2", relPath: "media/f2/original-ms1.mkv" }));

    const { fetchBytes, vues } = reseau();
    await heal(fetchBytes, db, SERVEUR, root, 10_000);

    expect(vues.some((u) => u.includes("/Items/f2"))).toBe(false);
  });

  it("ne leve jamais, meme si la racine est inaccessible", async () => {
    const db = openInMemory();
    const root = racinePreparee("tentacle-heal-");
    itemComplet(db, root, "f1");
    const { fetchBytes } = reseau({ "/Items/f1?fields=Trickplay": '{"Name":"Un film"}' });

    // Racine inexistante : chaque écriture échoue, la réparation continue.
    await expect(
      heal(fetchBytes, db, SERVEUR, "Z:\\racine-absente", 10_000),
    ).resolves.toBeTypeOf("number");
  });
});
