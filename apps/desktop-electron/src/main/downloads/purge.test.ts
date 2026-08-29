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
import { countRows, writeMedia, preparedRoot, spec } from "./testkit";

const REL = "media/item1/original-ms1.mkv";
/** t = 1 000 s, en millisecondes. */
const WATCHED_AT = 1_000_000;

function prepare(): { db: DatabaseSync; root: string; fileId: number } {
  const root = preparedRoot("tentacle-purge-");
  writeMedia(root, REL);
  const db = openInMemory();
  const fileId = claimOrCreateFile(db, spec({ autoDeleteAfterWatch: true })).fileId;
  return { db, root, fileId };
}

/** Marque vu et pose l'échéance, comme le fait l'enregistrement de progression. */
function markWatchedAndSchedule(db: DatabaseSync, fileId: number, delayMinutes: number): void {
  setAutoDelete(db, "u", fileId, true, delayMinutes, WATCHED_AT);
  setPlaybackState(db, "u", "item1", 9_000, true, false, WATCHED_AT);
  scheduleOnPlayed(db, "u", "item1", WATCHED_AT);
}

describe("pose de l'echeance", () => {
  it("le passage a vu planifie, delai compris", () => {
    const { db, fileId } = prepare();
    setAutoDelete(db, "u", fileId, true, 30, WATCHED_AT);
    setPlaybackState(db, "u", "item1", 9_000, true, false, WATCHED_AT);

    scheduleOnPlayed(db, "u", "item1", WATCHED_AT);

    const row = db.prepare("SELECT delete_scheduled_at AS a FROM claims").get();
    expect(Number(row?.["a"])).toBe(1_000 + 30 * 60);
  });

  it("un item non vu n'est pas planifie", () => {
    const { db, fileId } = prepare();
    setAutoDelete(db, "u", fileId, true, 30, WATCHED_AT);

    scheduleOnPlayed(db, "u", "item1", WATCHED_AT);

    const row = db.prepare("SELECT delete_scheduled_at AS a FROM claims").get();
    expect(row?.["a"]).toBeNull();
  });

  it("une echeance deja posee n'est jamais repoussee", () => {
    const { db, fileId } = prepare();
    markWatchedAndSchedule(db, fileId, 30);

    // Un second passage « vu », bien plus tard.
    scheduleOnPlayed(db, "u", "item1", WATCHED_AT + 5_000_000);

    const row = db.prepare("SELECT delete_scheduled_at AS a FROM claims").get();
    expect(Number(row?.["a"])).toBe(1_000 + 30 * 60);
  });
});

describe("purge", () => {
  it("efface une echeance passee", () => {
    const { db, root, fileId } = prepare();
    markWatchedAndSchedule(db, fileId, 0);

    // Bien apres l'echeance : le heartbeat n'est plus frais.
    const purges = purgeDueClaims(db, root, WATCHED_AT + 10 * 60_000, null);

    expect(purges).toBe(1);
    expect(countRows(db, "claims")).toBe(0);
    expect(existsSync(path.join(root, REL))).toBe(false);
  });

  it("n'efface pas une echeance a venir", () => {
    const { db, root, fileId } = prepare();
    markWatchedAndSchedule(db, fileId, 60);

    expect(purgeDueClaims(db, root, WATCHED_AT + 60_000, null)).toBe(0);
    expect(countRows(db, "claims")).toBe(1);
  });

  it("saute un item en cours de re-visionnage", () => {
    const { db, root, fileId } = prepare();
    markWatchedAndSchedule(db, fileId, 0);
    // Heartbeat frais : quelqu'un le regarde en ce moment.
    const now = WATCHED_AT + 10 * 60_000;
    setPlaybackState(db, "u", "item1", 500, false, false, now - 10_000);

    expect(purgeDueClaims(db, root, now, null)).toBe(0);
    expect(existsSync(path.join(root, REL))).toBe(true);
  });

  it("l'item qui vient de se terminer est exempte de la garde", () => {
    const { db, root, fileId } = prepare();
    markWatchedAndSchedule(db, fileId, 0);
    const now = WATCHED_AT + 1_000;
    // Heartbeat tout frais — c'est le lecteur qui se demonte.
    setPlaybackState(db, "u", "item1", 9_000, true, false, now);

    // Sans l'exemption, le delai « immediatement » ne s'appliquerait jamais.
    expect(purgeDueClaims(db, root, now, "item1")).toBe(1);
    expect(existsSync(path.join(root, REL))).toBe(false);
  });

  it("un fichier revendique par deux comptes survit au premier passage", () => {
    const root = preparedRoot("tentacle-purge-");
    writeMedia(root, REL);
    const db = openInMemory();
    const fileId = claimOrCreateFile(db, spec({ userId: "userA", autoDeleteAfterWatch: true })).fileId;
    claimOrCreateFile(db, spec({ userId: "userB" }));
    setAutoDelete(db, "userA", fileId, true, 0, WATCHED_AT);
    setPlaybackState(db, "userA", "item1", 9_000, true, false, WATCHED_AT);
    scheduleOnPlayed(db, "userA", "item1", WATCHED_AT);

    expect(purgeDueClaims(db, root, WATCHED_AT + 10 * 60_000, null)).toBe(1);
    // Le claim de userA est parti, le fichier reste pour userB.
    expect(countRows(db, "claims")).toBe(1);
    expect(existsSync(path.join(root, REL))).toBe(true);
  });

  it("sans echeance, il n'y a rien a purger", () => {
    const { db, root } = prepare();
    expect(purgeDueClaims(db, root, WATCHED_AT + 10 * 60_000, null)).toBe(0);
  });
});
