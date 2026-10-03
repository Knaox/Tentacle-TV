import { describe, expect, it } from "vitest";
import { releaseHighlights } from "./releaseNotes";

/** La forme réelle d'une publication du serveur (server-v1.22.2, abrégée). */
const BODY = [
  "Image Docker : `ghcr.io/knaox/tentacle-tv:v1.22.2` (et `:latest`).",
  "",
  "Client LG webOS servi sous `/tv` : inchangé.",
  "",
  "### FR",
  "- **Les bandes-annonces de l'Apple TV passent par le serveur** : elles échouaient presque toujours (2 lectures sur 20 au banc).",
  "- **Une extraction plus rapide, qui tient son temps** : yt-dlp reste chargé entre deux bandes-annonces.",
  "- **Administrateurs** : le journal du serveur dit chaque lecture de bande-annonce de l'Apple TV, avec le délai de la première image ou la raison de l'échec (lignes `[trailers]`) ; les clients se règlent par `TENTACLE_TRAILER_CLIENTS`",
  "- La version minimale exigée des clients reste 1.22.1",
  "- Un cinquième point qu'on ne montre pas.",
  "",
  "### EN",
  "- **Apple TV trailers go through the server**: they failed almost every time.",
  "* A plain [linked](https://example.com) point.",
].join("\n");

describe("l'essentiel des nouveautés d'une publication", () => {
  it("garde les premiers points de chaque langue, réduits à leur titre", () => {
    const { fr, en } = releaseHighlights(BODY);
    expect(fr).toHaveLength(4);
    expect(fr[0]).toBe("Les bandes-annonces de l'Apple TV passent par le serveur");
    expect(fr[1]).toBe("Une extraction plus rapide, qui tient son temps");
    expect(fr[3]).toBe("La version minimale exigée des clients reste 1.22.1");
    expect(en).toEqual(["Apple TV trailers go through the server", "A plain linked point"]);
  });

  it("un titre d'un mot ne dit rien seul : le point entier, sans Markdown, raccourci au mot", () => {
    const admin = releaseHighlights(BODY).fr[2] ?? "";
    expect(admin.startsWith("Administrateurs : le journal du serveur dit chaque lecture")).toBe(true);
    expect(admin).not.toContain("`");
    expect(admin.length).toBeLessThanOrEqual(141);
    expect(admin.endsWith("…")).toBe(true);
  });

  it("sans blocs de langue, ou sans corps : rien", () => {
    expect(releaseHighlights("- un point hors bloc")).toEqual({ fr: [], en: [] });
    expect(releaseHighlights(undefined)).toEqual({ fr: [], en: [] });
  });
});
