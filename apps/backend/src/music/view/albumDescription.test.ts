/**
 * La description d'un album (Jellyfin `Overview`) : propre, bornée, et jamais une vue album en échec quand Jellyfin
 * ne répond pas.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const jf = vi.hoisted(() => ({ calls: [] as string[], answer: { ok: true, data: {} } as { ok: boolean; data?: unknown } }));
vi.mock("../jellyfin/musicJellyfin", () => ({
  jfAdmin: async (path: string) => {
    jf.calls.push(path);
    return jf.answer;
  },
  q: (value: string) => encodeURIComponent(value),
}));

import { ALBUM_DESCRIPTION_MAX, albumDescription, descriptionOf } from "./albumDescription";

describe("descriptionOf", () => {
  it("rend le texte sans ses espaces de bord, fins de ligne unifiées", () => {
    expect(descriptionOf("  Contenu libre de droit.\r\nLicence : CC BY 4.0\r\n")).toBe("Contenu libre de droit.\nLicence : CC BY 4.0");
  });

  it("une description vide ou absente vaut null", () => {
    expect(descriptionOf("   \n ")).toBeNull();
    expect(descriptionOf(undefined)).toBeNull();
    expect(descriptionOf(null)).toBeNull();
  });

  it("coupe une description démesurée", () => {
    const text = descriptionOf("x".repeat(ALBUM_DESCRIPTION_MAX + 50))!;
    expect(text).toHaveLength(ALBUM_DESCRIPTION_MAX);
    expect(text.endsWith("…")).toBe(true);
  });
});

describe("albumDescription", () => {
  beforeEach(() => {
    jf.calls = [];
  });

  it("lit l'élément au nom du compte, l'Overview seul", async () => {
    jf.answer = { ok: true, data: { Overview: "Contenu libre de droit." } };
    await expect(albumDescription("user-1", "album-1")).resolves.toBe("Contenu libre de droit.");
    expect(jf.calls).toEqual(["/Items/album-1?userId=user-1&Fields=Overview&EnableImages=false"]);
  });

  it("Jellyfin en échec : pas de description, pas d'erreur", async () => {
    jf.answer = { ok: false };
    await expect(albumDescription("user-1", "album-1")).resolves.toBeNull();
  });
});
