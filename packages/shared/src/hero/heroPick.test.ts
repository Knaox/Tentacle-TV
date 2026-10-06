import { describe, expect, it } from "vitest";
import type { MediaItem } from "../types/media";
import { pickHeroMedia } from "./heroPick";

const withImage = (id: string): MediaItem => ({ Id: id, Name: id, Type: "Movie", BackdropImageTags: ["b"] });
const bare = (id: string): MediaItem => ({ Id: id, Name: id, Type: "Movie", ImageTags: {}, BackdropImageTags: [] });
const ids = (pick: { items: MediaItem[] }) => pick.items.map((i) => i.Id);

describe("pickHeroMedia", () => {
  it("titre fixe effacé de Jellyfin (404) : la reprise, jamais une bannière vide", () => {
    const pick = pickHeroMedia("fixed", { fixed: null, resume: [withImage("r1")], featured: [withImage("f1")] });
    expect(ids(pick)).toEqual(["r1"]);
    expect(pick.pending).toBe(false);
  });

  it("titre fixe effacé et aucune reprise : la sélection du serveur", () => {
    expect(ids(pickHeroMedia("fixed", { fixed: null, resume: [], featured: [withImage("f1")] }))).toEqual(["f1"]);
  });

  it("titre fixe en chargement : on l'attend (squelette)", () => {
    expect(pickHeroMedia("fixed", { fixed: undefined, resume: [withImage("r1")], featured: [] })).toEqual({ items: [], pending: true });
  });

  it("titre fixe sans aucune image : le repli", () => {
    expect(ids(pickHeroMedia("fixed", { fixed: bare("x"), resume: [withImage("r1")], featured: [] }))).toEqual(["r1"]);
  });

  it("titre fixe présent : lui seul", () => {
    expect(ids(pickHeroMedia("fixed", { fixed: withImage("x"), resume: undefined, featured: undefined }))).toEqual(["x"]);
  });

  it("les titres sans image sont écartés (Jellyfin 10.11 ignore HasBackdrop)", () => {
    const pick = pickHeroMedia("random", { fixed: null, resume: [], featured: [bare("a"), withImage("b"), bare("c")] });
    expect(ids(pick)).toEqual(["b"]);
  });

  it("reprise sans image du tout : la sélection prend le relais", () => {
    expect(ids(pickHeroMedia("resume", { fixed: null, resume: [bare("r")], featured: [withImage("f")] }))).toEqual(["f"]);
  });

  it("la reprise s'attend avant la sélection : rien ne saute", () => {
    expect(pickHeroMedia("resume", { fixed: null, resume: undefined, featured: [withImage("f")] }).pending).toBe(true);
  });

  it("aléatoire vide : la reprise", () => {
    expect(ids(pickHeroMedia("random", { fixed: null, resume: [withImage("r")], featured: [] }))).toEqual(["r"]);
  });

  it("rien nulle part : liste vide, rien à attendre — la bannière se retire", () => {
    expect(pickHeroMedia("reco", { fixed: null, resume: [], featured: [bare("x")] })).toEqual({ items: [], pending: false });
  });

  it("cinq titres au plus", () => {
    const many = Array.from({ length: 8 }, (_, i) => withImage(`r${i}`));
    expect(pickHeroMedia("resume", { fixed: null, resume: many, featured: [] }).items).toHaveLength(5);
  });
});
