/**
 * Une coupure réseau se relance SEULE (alpha mobile, 21/10) : application
 * derrière ou écran verrouillé, aucun des évènements qui relevaient une pause
 * système — premier plan, changement de réseau, redémarrage — n'arrive, et un
 * transfert coupé une fois ne repartait jamais.
 *
 * Horloge injectée partout : l'échéance se lit, le temps avance à la main.
 */

import { describe, expect, it, vi } from "vitest";
import { openInMemory } from "../node/nodeDatabase";
import { getFile, requeueSystemPauses } from "./queue";
import { NETWORK_RETRY_DELAYS_MS, networkRetryDelay, nextRetryDueAt, requeueDueRetries, scheduleNetworkRetry } from "./retry";
import type { TransferNet, TransferStream } from "./transferNet";
import { CREDS, makeEngine, rootWithThreeItems, seed } from "./testkit";

/** Réseau qui coupe `failures` fois (502, ou un flux tronqué), puis livre. */
function flakyNet(failures: number, mode: "status" | "midstream" = "status"): { net: TransferNet; opened: () => number } {
  let opened = 0;
  const net: TransferNet = {
    async open(): Promise<TransferStream> {
      opened += 1;
      const fail = opened <= failures;
      if (fail && mode === "status") {
        return { status: 502, header: () => null, chunks: (async function* () {})() };
      }
      return {
        status: 200,
        header: () => null,
        chunks: (async function* () {
          yield new Uint8Array(new Array(5 * 1024 * 1024).fill(1));
          if (fail) throw new Error("flux coupé");
        })(),
      };
    },
    async killTranscode() {
      /* rien */
    },
  };
  return { net, opened: () => opened };
}

describe("échelle des relances réseau", () => {
  it("monte, puis répète sa dernière marche — sans jamais renoncer", () => {
    expect(networkRetryDelay(0)).toBe(5_000);
    expect(networkRetryDelay(1)).toBe(15_000);
    expect(networkRetryDelay(NETWORK_RETRY_DELAYS_MS.length - 1)).toBe(300_000);
    expect(networkRetryDelay(500)).toBe(300_000);
    expect(networkRetryDelay(-3)).toBe(5_000);
  });

  it("une échelle vide ne relance rien", () => {
    expect(networkRetryDelay(0, [])).toBeNull();
  });
});

describe("la file et les pauses datées", () => {
  it("une pause système datée revient en file à son échéance, pas avant", () => {
    const db = openInMemory();
    const fileId = seed(db, "item1", 1_000);
    db.prepare("UPDATE files SET status = 'paused', paused_by_user = 0 WHERE id = ?").run(fileId);
    scheduleNetworkRetry(db, fileId, 6_000, 1_000);
    expect(nextRetryDueAt(db)).toBe(6_000);

    expect(requeueDueRetries(db, 5_999)).toBe(0);
    expect(requeueDueRetries(db, 6_000)).toBe(1);
    expect(getFile(db, fileId)?.status).toBe("queued");
    expect(getFile(db, fileId)?.nextRetryAt).toBeNull();
  });

  it("une pause de l'utilisateur ne repart jamais seule, même datée", () => {
    const db = openInMemory();
    const fileId = seed(db, "item1", 1_000);
    db.prepare("UPDATE files SET status = 'paused', paused_by_user = 1, next_retry_at = 2_000 WHERE id = ?").run(fileId);
    expect(nextRetryDueAt(db)).toBeNull();
    expect(requeueDueRetries(db, 10_000)).toBe(0);
    expect(getFile(db, fileId)?.status).toBe("paused");
  });

  it("une reprise par évènement efface l'échéance : pas de second départ", () => {
    const db = openInMemory();
    const fileId = seed(db, "item1", 1_000);
    db.prepare("UPDATE files SET status = 'paused', paused_by_user = 0 WHERE id = ?").run(fileId);
    scheduleNetworkRetry(db, fileId, 6_000, 1_000);
    expect(requeueSystemPauses(db, 2_000)).toBe(1);
    expect(getFile(db, fileId)?.nextRetryAt).toBeNull();
  });
});

describe("le moteur relance une coupure de lui-même", () => {
  it("coupé deux fois sans un octet, il attend une marche de plus à chaque fois, puis aboutit", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = seed(db, "item1", 1_000);
    let clock = 1_000;
    const flaky = flakyNet(2);
    const { engine } = makeEngine(db, root, flaky.net, { now: () => clock, networkRetryDelaysMs: [10, 40] });

    engine.start(CREDS);
    await vi.waitFor(() => expect(getFile(db, fileId)?.nextRetryAt).toBe(1_010));
    expect(getFile(db, fileId)?.status).toBe("paused");

    clock = 1_010;
    engine.sweepRetries();
    // Deuxième coupure SANS octet reçu : la marche suivante.
    await vi.waitFor(() => expect(getFile(db, fileId)?.nextRetryAt).toBe(1_050));

    clock = 1_050;
    engine.sweepRetries();
    await vi.waitFor(() => expect(getFile(db, fileId)?.status).toBe("complete"));
    expect(flaky.opened()).toBe(3);
    expect(getFile(db, fileId)?.nextRetryAt).toBeNull();
  });

  it("un flux coupé APRÈS des octets repart de la première marche", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = seed(db, "item1", 1_000);
    let clock = 1_000;
    // Allégé : il repart de zéro à chaque essai, aucune reprise par plage ne s'en mêle.
    db.prepare("UPDATE files SET variant = 'light', preset = 'p480' WHERE id = ?").run(fileId);
    const flaky = flakyNet(2, "midstream");
    const { engine } = makeEngine(db, root, flaky.net, { now: () => clock, networkRetryDelaysMs: [10, 40] });

    engine.start(CREDS);
    await vi.waitFor(() => expect(getFile(db, fileId)?.nextRetryAt).toBe(1_010));
    clock = 1_010;
    engine.sweepRetries();
    // Des octets sont arrivés pendant l'essai : 10 ms encore, pas 40.
    await vi.waitFor(() => expect(getFile(db, fileId)?.nextRetryAt).toBe(1_020));
  });

  it("sans échelle, la coupure attend un évènement, comme avant", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = seed(db, "item1", 1_000);
    const { engine } = makeEngine(db, root, flakyNet(1).net);
    engine.start(CREDS);
    await vi.waitFor(() => expect(getFile(db, fileId)?.status).toBe("paused"));
    expect(getFile(db, fileId)?.nextRetryAt).toBeNull();
  });
});
