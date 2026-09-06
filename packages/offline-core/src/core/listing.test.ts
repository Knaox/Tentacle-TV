/**
 * Les listes et l'auto-suppression différée.
 *
 * Le cloisonnement par utilisateur et le REBASE de l'échéance ne se voient pas
 * à l'écran : l'un ne se remarque qu'au moment où il manque, l'autre se
 * mesurerait en heures.
 */

import type { DatabaseHandle } from "./adapters";
import { describe, expect, it } from "vitest";
import { openInMemory } from "../node/nodeDatabase";
import { listForUser, setAutoDelete, stateForItem } from "./listing";
import { upsertItemMeta } from "./meta";
import { setPausedByUser, setStatus } from "./queue";
import { claimOrCreateFile } from "./store";
import { markWatched, spec } from "./testkit";

function unClaim(db: DatabaseHandle): number {
  return claimOrCreateFile(db, spec()).fileId;
}

describe("listes", () => {
  it("sont cloisonnees par utilisateur", () => {
    const db = openInMemory();
    claimOrCreateFile(db, spec({ userId: "userA" }));
    claimOrCreateFile(
      db,
      spec({
        userId: "userB",
        itemId: "item2",
        mediaSourceId: "ms2",
        variant: "light",
        preset: "p720",
        relPath: "media/item2/light-ms2-p720.mp4",
      }),
    );

    expect(listForUser(db, "userA").map((e) => e.itemId)).toEqual(["item1"]);
    expect(listForUser(db, "userB").map((e) => e.itemId)).toEqual(["item2"]);
    expect(listForUser(db, "userC")).toEqual([]);
  });

  it("ne transmettent JAMAIS la liste interne des side-cars", () => {
    const db = openInMemory();
    const fileId = unClaim(db);
    db.prepare("UPDATE files SET subtitles_json = ? WHERE id = ?").run('[{"index":3}]', fileId);

    const entry = listForUser(db, "u")[0];

    expect(entry).toBeDefined();
    expect(Object.keys(entry ?? {})).not.toContain("subtitlesJson");
  });

  // Le filtre du catalogue local se fait sur la bibliothèque Jellyfin
  // D'ORIGINE (Films, Séries, Animés…), pas sur le type du titre.
  it("portent la bibliotheque d'origine du titre", () => {
    const db = openInMemory();
    unClaim(db);
    expect(listForUser(db, "u")[0]?.libraryId).toBeNull();
    upsertItemMeta(db, {
      itemId: "item1", kind: "movie", seriesId: null, seasonId: null, libraryId: "lib-animes",
      runtimeTicks: null, title: "Un film", seriesName: null, indexNumber: null, parentIndexNumber: null,
    }, 1_000);
    expect(listForUser(db, "u")[0]?.libraryId).toBe("lib-animes");
  });

  // Hors ligne il n'y a AUCUN DTO serveur : cette liste est la seule voie par
  // laquelle la coche « vu » d'une vignette peut arriver.
  it("portent la progression du compte", () => {
    const db = openInMemory();
    unClaim(db);
    markWatched(db, "u", "item1");

    const entry = listForUser(db, "u")[0];

    expect(entry?.played).toBe(true);
    expect(stateForItem(db, "u", "item1")?.played).toBe(true);
  });

  it("portent la date d'ajout du fichier, en millisecondes", () => {
    const db = openInMemory();
    claimOrCreateFile(db, spec({ nowMs: 1_700_000_000_000 }));

    expect(listForUser(db, "u")[0]?.createdAt).toBe(1_700_000_000_000);
  });

  // L'ordre de « Reprendre » : le titre repris en dernier d'abord — et sans
  // lecture, aucune date plutôt qu'une date inventée.
  it("portent la date de la derniere lecture, nulle sans lecture", () => {
    const db = openInMemory();
    unClaim(db);
    expect(listForUser(db, "u")[0]?.lastPlayedAt).toBeNull();

    markWatched(db, "u", "item1");
    expect(listForUser(db, "u")[0]?.lastPlayedAt).toBe(1);
    expect(stateForItem(db, "u", "item1")?.lastPlayedAt).toBe(1);
  });

  // « En pause » (l'utilisateur) et « En attente du Wi-Fi » (le système) ne
  // se libellent pas pareil : la liste doit dire laquelle des deux c'est.
  it("distinguent une pause explicite d'une pause systeme", () => {
    const db = openInMemory();
    const fileId = unClaim(db);
    setStatus(db, fileId, "paused", null, 2_000);
    expect(listForUser(db, "u")[0]?.pausedByUser).toBe(false);

    setPausedByUser(db, fileId, true);
    expect(listForUser(db, "u")[0]?.pausedByUser).toBe(true);
    expect(stateForItem(db, "u", "item1")?.pausedByUser).toBe(true);
  });

  it("rendent une progression NEUTRE pour un item jamais ouvert", () => {
    // Jointure externe : sans ligne de progression, SQLite rend NULL — et une
    // lecture stricte y leverait au lieu de rendre « pas encore vu ».
    const db = openInMemory();
    unClaim(db);

    const entry = listForUser(db, "u")[0];

    expect(entry?.played).toBe(false);
    expect(entry?.positionTicks).toBe(0);
  });

  it("ne montrent pas la progression d'un AUTRE compte", () => {
    // Deux personnes partagent le meme fichier et n'en sont pas au meme
    // endroit : la vignette de l'une ne doit rien dire de l'autre.
    const db = openInMemory();
    claimOrCreateFile(db, spec({ userId: "userA" }));
    claimOrCreateFile(db, spec({ userId: "userB" }));
    markWatched(db, "userA", "item1");

    expect(listForUser(db, "userA")[0]?.played).toBe(true);
    expect(listForUser(db, "userB")[0]?.played).toBe(false);
  });

  it("l'etat par item prefere le complet", () => {
    const db = openInMemory();
    claimOrCreateFile(
      db,
      spec({ variant: "light", preset: "p720", relPath: "media/item1/light-ms1-p720.mp4" }),
    );
    const original = claimOrCreateFile(db, spec());
    db.prepare("UPDATE files SET status = 'complete' WHERE id = ?").run(original.fileId);

    expect(stateForItem(db, "u", "item1")?.id).toBe(original.fileId);
    expect(stateForItem(db, "u", "inconnu")).toBeNull();
  });

  it("un item sans meta reste listable", () => {
    // La jointure sur `item_meta` est un LEFT JOIN : un telechargement dont la
    // meta a ete purgee ne doit pas disparaitre de la liste.
    const db = openInMemory();
    unClaim(db);
    db.exec("DELETE FROM item_meta");

    const entry = listForUser(db, "u")[0];

    expect(entry?.itemId).toBe("item1");
    expect(entry?.title).toBeNull();
  });
});

describe("auto-suppression differee", () => {
  it("desactiver remet tout a zero", () => {
    const db = openInMemory();
    const fileId = unClaim(db);
    markWatched(db, "u", "item1");
    setAutoDelete(db, "u", fileId, true, 60, 1_000_000);

    setAutoDelete(db, "u", fileId, false, 0, 2_000_000);

    const entry = listForUser(db, "u")[0];
    expect(entry?.autoDeleteAfterWatch).toBe(false);
    expect(entry?.autoDeleteDelayMinutes).toBe(0);
    expect(entry?.deleteScheduledAt).toBeNull();
  });

  it("activer sur un item NON VU ne planifie rien", () => {
    const db = openInMemory();
    const fileId = unClaim(db);

    setAutoDelete(db, "u", fileId, true, 30, 1_000_000);

    expect(listForUser(db, "u")[0]?.deleteScheduledAt).toBeNull();
  });

  it("activer sur un item DEJA VU planifie depuis maintenant", () => {
    const db = openInMemory();
    const fileId = unClaim(db);
    markWatched(db, "u", "item1");

    setAutoDelete(db, "u", fileId, true, 30, 1_000_000);

    // Jamais de suppression surprise pour avoir coche une case a posteriori.
    expect(listForUser(db, "u")[0]?.deleteScheduledAt).toBe(1_000 + 30 * 60);
  });

  it("changer le delai REBASE sur le moment du visionnage", () => {
    const db = openInMemory();
    const fileId = unClaim(db);
    markWatched(db, "u", "item1");
    setAutoDelete(db, "u", fileId, true, 30, 1_000_000); // vu a t = 1000 s

    // Bien plus tard, le delai passe a 60 min : l'echeance reste ancree au
    // visionnage, elle ne repart pas de maintenant.
    setAutoDelete(db, "u", fileId, true, 60, 9_000_000);

    expect(listForUser(db, "u")[0]?.deleteScheduledAt).toBe(1_000 + 60 * 60);
  });

  it("un delai negatif est ramene a zero", () => {
    const db = openInMemory();
    const fileId = unClaim(db);
    markWatched(db, "u", "item1");

    setAutoDelete(db, "u", fileId, true, -5, 1_000_000);

    expect(listForUser(db, "u")[0]?.autoDeleteDelayMinutes).toBe(0);
  });

  it("un claim inconnu est ignore sans lever", () => {
    const db = openInMemory();
    expect(() => setAutoDelete(db, "u", 999, true, 30, 1_000_000)).not.toThrow();
  });
});
