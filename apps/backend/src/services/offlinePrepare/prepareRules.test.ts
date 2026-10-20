/**
 * Les règles pures de la préparation tenue par le serveur : la clé, la plage
 * honorée, l'effacement d'une préparation oubliée. Horloge injectée.
 */

import { describe, expect, it } from "vitest";
import { parseLightRequest } from "./lightStream";
import {
  PREPARED_IDLE_TTL_MS,
  prepareExpired,
  prepareKey,
  rangeStart,
  readerTag,
  RUNNING_IDLE_TTL_MS,
  servedFrom,
} from "./prepareRules";

const ITEM = "0123456789abcdef0123456789abcdef";

function request(query: Record<string, string> = {}) {
  const parsed = parseLightRequest(ITEM, { preset: "p720", ...query });
  if (parsed === null) throw new Error("demande refusée");
  return parsed;
}

describe("la clé d'une préparation", () => {
  it("la même demande du même compte donne la même préparation — jamais deux", () => {
    expect(prepareKey("u1", request())).toBe(prepareKey("u1", request()));
    expect(prepareKey("u1", request({ mediaSourceId: ITEM.toUpperCase() }))).toBe(
      prepareKey("u1", request({ mediaSourceId: ITEM })),
    );
  });

  it("un autre compte, un autre palier ou une autre piste : une autre préparation", () => {
    const base = prepareKey("u1", request());
    expect(prepareKey("u2", request())).not.toBe(base);
    expect(prepareKey("u1", request({ preset: "p480" }))).not.toBe(base);
    expect(prepareKey("u1", request({ audioStreamIndex: "2" }))).not.toBe(base);
    expect(prepareKey("u1", request({ burnSubtitleIndex: "3" }))).not.toBe(base);
  });

  it("un palier inconnu ou un titre mal formé est refusé", () => {
    expect(parseLightRequest(ITEM, { preset: "p9000" })).toBeNull();
    expect(parseLightRequest("../etc", { preset: "p720" })).toBeNull();
  });
});

describe("la plage d'octets", () => {
  it("lit `bytes=N-` et rien d'autre", () => {
    expect(rangeStart("bytes=1024-")).toBe(1024);
    expect(rangeStart("bytes=0-")).toBe(0);
    expect(rangeStart("bytes=10-20")).toBeNull();
    expect(rangeStart("bytes=-500")).toBeNull();
    expect(rangeStart(undefined)).toBeNull();
  });

  it("l'étiquette d'appareil a une forme simple", () => {
    expect(readerTag("dev_0123abcd")).toBe("dev_0123abcd");
    expect(readerTag("court")).toBeNull();
    expect(readerTag("a/b/c/d/e/f/g/h")).toBeNull();
  });

  it("une reprise n'est honorée que par une préparation déjà lue par CET appareil", () => {
    const job = { state: "running" as const, bytes: 10_000 };
    expect(servedFrom(4_000, job, true)).toBe(4_000);
    // Recréée (serveur redémarré, autre appareil) : ses octets peuvent différer.
    expect(servedFrom(4_000, job, false)).toBe(0);
  });

  it("le téléphone en a plus que la préparation : son morceau vient d'ailleurs, on repart de zéro", () => {
    expect(servedFrom(20_000, { state: "running", bytes: 10_000 }, true)).toBe(0);
    expect(servedFrom(10_000, { state: "done", bytes: 10_000 }, true)).toBe(10_000);
  });
});

describe("l'effacement d'une préparation", () => {
  const at = 1_000_000;
  const base = { readers: 0, released: false, lastAccessAt: at };

  it("prête, elle attend le téléphone une journée après son dernier passage", () => {
    expect(prepareExpired({ ...base, state: "done" }, at + PREPARED_IDLE_TTL_MS - 1)).toBe(false);
    expect(prepareExpired({ ...base, state: "done" }, at + PREPARED_IDLE_TTL_MS)).toBe(true);
  });

  it("en cours, elle continue sans personne — jusqu'à douze heures sans nouvelle", () => {
    expect(prepareExpired({ ...base, state: "running" }, at + 60 * 60 * 1000)).toBe(false);
    expect(prepareExpired({ ...base, state: "running" }, at + RUNNING_IDLE_TTL_MS)).toBe(true);
  });

  it("relâchée ou échouée, elle s'efface — mais jamais sous un lecteur", () => {
    expect(prepareExpired({ ...base, state: "done", released: true }, at)).toBe(true);
    expect(prepareExpired({ ...base, state: "failed" }, at)).toBe(true);
    expect(prepareExpired({ ...base, state: "failed", readers: 1 }, at)).toBe(false);
  });
});
