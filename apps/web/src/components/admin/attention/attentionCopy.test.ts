import { beforeAll, describe, expect, it } from "vitest";
import { i18n, initI18n } from "@tentacle-tv/shared";
import { ENTRY_ACTION, detailsKind, entryKeys, type EntryId } from "./attentionCopy";

const IDS = Object.keys(ENTRY_ACTION) as EntryId[];
let fr: Record<string, unknown> = {};
const known = (key: string) => key in fr;

beforeAll(() => {
  initI18n();
  fr = (i18n.getResourceBundle("fr", "adminOverview") ?? {}) as Record<string, unknown>;
});

describe("ce que dit et propose chaque entrée de la vue d'ensemble", () => {
  it("chaque entrée a UNE action, et son libellé existe", () => {
    for (const id of IDS) {
      const action = ENTRY_ACTION[id];
      expect(known(action.label), id).toBe(true);
      if (action.kind === "toggle") expect(known(action.hideLabel)).toBe(true);
    }
  });

  it("la variante d'abord, l'identifiant ensuite", () => {
    expect(entryKeys("publicUrl", "not-https", "title")).toEqual(["entry_publicUrl_not-https_title", "entry_publicUrl_title"]);
    expect(entryKeys("tmdbKey", null, "body")).toEqual(["entry_tmdbKey_body"]);
  });

  it("chaque détail en phrase a sa clé, par sa variante ou par son identifiant", () => {
    const variants: Partial<Record<EntryId, string[]>> = {
      jellyfinNotConfigured: ["key", "url", "both"],
      jellyfinKeyRejected: ["revoked", "no-rights"],
    };
    for (const id of IDS.filter((entry) => detailsKind(entry) === "text")) {
      for (const variant of variants[id] ?? [null]) {
        expect(entryKeys(id, variant, "details").some(known), `${id}/${String(variant)}`).toBe(true);
      }
    }
  });

  it("les adresses se déplient pour le lien public et la lecture directe ; Jellyfin par son action", () => {
    expect(detailsKind("publicUrl")).toBe("links");
    expect(detailsKind("directPlay")).toBe("links");
    expect(detailsKind("jellyfin")).toBe("none");
  });
});
