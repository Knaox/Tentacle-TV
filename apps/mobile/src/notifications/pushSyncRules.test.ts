import { describe, expect, it } from "vitest";
import {
  addKnownPresented,
  KNOWN_PRESENTED_MAX,
  parseKnownPresented,
  presentedEntryOf,
  presentedToWithdraw,
  reconcilePresented,
} from "./pushSyncRules";

const entry = (requestId: string, notificationId: string | null) => ({ requestId, notificationId });

describe("presentedEntryOf", () => {
  it("lit l'identifiant serveur posé dans les données de la push", () => {
    expect(presentedEntryOf({ request: { identifier: "sys1", content: { data: { notificationId: "n1", type: "ticket_reply" } } } }))
      .toEqual(entry("sys1", "n1"));
  });

  it("une push d'avant (sans identifiant) ou locale n'en a pas", () => {
    expect(presentedEntryOf({ request: { identifier: "sys2", content: { data: { type: "library_added" } } } })).toEqual(entry("sys2", null));
    expect(presentedEntryOf({ request: { identifier: "sys3", content: {} } })).toEqual(entry("sys3", null));
  });
});

describe("reconcilePresented — balayée = lue (filet au retour dans l'app)", () => {
  it("vue ici puis disparue du centre du système : lue", () => {
    const r = reconcilePresented({ known: ["n1", "n2"], presented: [entry("s2", "n2"), entry("s3", "n3")] });
    expect(r.readNow).toEqual(["n1"]);
    expect(r.nextKnown.sort()).toEqual(["n2", "n3"]);
  });

  it("jamais vue sur ce téléphone : jamais marquée (arrivée ailleurs, perdue en route)", () => {
    expect(reconcilePresented({ known: [], presented: [] }).readNow).toEqual([]);
  });

  it("les notifications sans identifiant serveur sont ignorées", () => {
    expect(reconcilePresented({ known: [], presented: [entry("s1", null)] }).nextKnown).toEqual([]);
  });
});

describe("presentedToWithdraw — lue ailleurs = retirée de ce téléphone", () => {
  const presented = [entry("s1", "n1"), entry("s2", "n2"), entry("s3", null), entry("s4", "old")];

  it("retire ce que le serveur dit lu, garde le reste", () => {
    const serverList = [{ id: "n1", read: true }, { id: "n2", read: false }];
    expect(presentedToWithdraw({ presented, serverList, unreadCount: 1 }).map((e) => e.requestId)).toEqual(["s1"]);
  });

  it("plus aucune non lue : tout ce qui vient du serveur part, le local reste", () => {
    expect(presentedToWithdraw({ presented, serverList: [], unreadCount: 0 }).map((e) => e.requestId)).toEqual(["s1", "s2", "s4"]);
  });

  it("serveur pas encore lu : rien ne part", () => {
    expect(presentedToWithdraw({ presented, serverList: undefined, unreadCount: undefined })).toEqual([]);
  });
});

describe("relevé des notifications vues", () => {
  it("se relit sans planter, borné", () => {
    expect(parseKnownPresented(null)).toEqual([]);
    expect(parseKnownPresented("{oops")).toEqual([]);
    expect(parseKnownPresented('["a", 3, "b"]')).toEqual(["a", "b"]);
    const many = JSON.stringify(Array.from({ length: 100 }, (_, i) => `n${i}`));
    expect(parseKnownPresented(many)).toHaveLength(KNOWN_PRESENTED_MAX);
  });

  it("ajoute sans doublon, le plus récent à la fin", () => {
    expect(addKnownPresented(["a", "b"], "a")).toEqual(["b", "a"]);
  });
});
