/**
 * L'auto-suppression différée.
 *
 * La garde anti-suppression est ce qui empêche un film de disparaître sous les
 * yeux de celui qui le re-regarde — et elle ne se déclenche jamais dans un
 * usage normal, donc elle ne se voit qu'ici.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { openInMemory } from "./db";
import { setAutoDelete } from "./listing";
import { setPlaybackState } from "./playback";
import { purgeDueClaims, scheduleOnPlayed } from "./purge";
import { claimOrCreateFile } from "./store";
import { compter, ecrireMedia, racinePreparee, spec } from "./testkit";

const REL = "media/item1/original-ms1.mkv";
/** t = 1 000 s, en millisecondes. */
const VU_A = 1_000_000;

function preparer(): { db: DatabaseSync; root: string; fileId: number } {
  const root = racinePreparee("tentacle-purge-");
  ecrireMedia(root, REL);
  const db = openInMemory();
  const fileId = claimOrCreateFile(db, spec({ autoDeleteAfterWatch: true })).fileId;
  return { db, root, fileId };
}

/** Marque vu et pose l'échéance, comme le fait l'enregistrement de progression. */
function marquerVuEtPlanifier(db: DatabaseSync, fileId: number, delaiMinutes: number): void {
  setAutoDelete(db, "u", fileId, true, delaiMinutes, VU_A);
  setPlaybackState(db, "u", "item1", 9_000, true, false, VU_A);
  scheduleOnPlayed(db, "u", "item1", VU_A);
}

describe("pose de l'echeance", () => {
  it("le passage a vu planifie, delai compris", () => {
    const { db, fileId } = preparer();
    setAutoDelete(db, "u", fileId, true, 30, VU_A);
    setPlaybackState(db, "u", "item1", 9_000, true, false, VU_A);

    scheduleOnPlayed(db, "u", "item1", VU_A);

    const row = db.prepare("SELECT delete_scheduled_at AS a FROM claims").get();
    expect(Number(row?.["a"])).toBe(1_000 + 30 * 60);
  });

  it("un item non vu n'est pas planifie", () => {
    const { db, fileId } = preparer();
    setAutoDelete(db, "u", fileId, true, 30, VU_A);

    scheduleOnPlayed(db, "u", "item1", VU_A);

    const row = db.prepare("SELECT delete_scheduled_at AS a FROM claims").get();
    expect(row?.["a"]).toBeNull();
  });

  it("une echeance deja posee n'est jamais repoussee", () => {
    const { db, fileId } = preparer();
    marquerVuEtPlanifier(db, fileId, 30);

    // Un second passage « vu », bien plus tard.
    scheduleOnPlayed(db, "u", "item1", VU_A + 5_000_000);

    const row = db.prepare("SELECT delete_scheduled_at AS a FROM claims").get();
    expect(Number(row?.["a"])).toBe(1_000 + 30 * 60);
  });
});

describe("purge", () => {
  it("efface une echeance passee", () => {
    const { db, root, fileId } = preparer();
    marquerVuEtPlanifier(db, fileId, 0);

    // Bien apres l'echeance : le heartbeat n'est plus frais.
    const purges = purgeDueClaims(db, root, VU_A + 10 * 60_000, null);

    expect(purges).toBe(1);
    expect(compter(db, "claims")).toBe(0);
    expect(existsSync(path.join(root, REL))).toBe(false);
  });

  it("n'efface pas une echeance a venir", () => {
    const { db, root, fileId } = preparer();
    marquerVuEtPlanifier(db, fileId, 60);

    expect(purgeDueClaims(db, root, VU_A + 60_000, null)).toBe(0);
    expect(compter(db, "claims")).toBe(1);
  });

  it("saute un item en cours de re-visionnage", () => {
    const { db, root, fileId } = preparer();
    marquerVuEtPlanifier(db, fileId, 0);
    // Heartbeat frais : quelqu'un le regarde en ce moment.
    const maintenant = VU_A + 10 * 60_000;
    setPlaybackState(db, "u", "item1", 500, false, false, maintenant - 10_000);

    expect(purgeDueClaims(db, root, maintenant, null)).toBe(0);
    expect(existsSync(path.join(root, REL))).toBe(true);
  });

  it("l'item qui vient de se terminer est exempte de la garde", () => {
    const { db, root, fileId } = preparer();
    marquerVuEtPlanifier(db, fileId, 0);
    const maintenant = VU_A + 1_000;
    // Heartbeat tout frais — c'est le lecteur qui se demonte.
    setPlaybackState(db, "u", "item1", 9_000, true, false, maintenant);

    // Sans l'exemption, le delai « immediatement » ne s'appliquerait jamais.
    expect(purgeDueClaims(db, root, maintenant, "item1")).toBe(1);
    expect(existsSync(path.join(root, REL))).toBe(false);
  });

  it("un fichier revendique par deux comptes survit au premier passage", () => {
    const root = racinePreparee("tentacle-purge-");
    ecrireMedia(root, REL);
    const db = openInMemory();
    const fileId = claimOrCreateFile(db, spec({ userId: "userA", autoDeleteAfterWatch: true })).fileId;
    claimOrCreateFile(db, spec({ userId: "userB" }));
    setAutoDelete(db, "userA", fileId, true, 0, VU_A);
    setPlaybackState(db, "userA", "item1", 9_000, true, false, VU_A);
    scheduleOnPlayed(db, "userA", "item1", VU_A);

    expect(purgeDueClaims(db, root, VU_A + 10 * 60_000, null)).toBe(1);
    // Le claim de userA est parti, le fichier reste pour userB.
    expect(compter(db, "claims")).toBe(1);
    expect(existsSync(path.join(root, REL))).toBe(true);
  });

  it("sans echeance, il n'y a rien a purger", () => {
    const { db, root } = preparer();
    expect(purgeDueClaims(db, root, VU_A + 10 * 60_000, null)).toBe(0);
  });
});
