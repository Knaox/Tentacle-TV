import { describe, expect, it } from "vitest";
import {
  parseTitleKey,
  readTitleRequestOutcome,
  readTitleStates,
  titleKey,
  titleMediaType,
  titleProvider,
  titleRequestUrl,
  titleStateUrl,
  type TitleKey,
} from "./pluginTitles";

const vigie = { pluginId: "seer", configEnabled: true, titles: { state: "/titles/state", request: "/titles/request" } };

describe("la source des titres hors bibliothèque", () => {
  it("retient le premier plugin configuré qui déclare `titles`", () => {
    expect(titleProvider([{ pluginId: "x", configEnabled: true }, vigie])).toEqual({
      pluginId: "seer", statePath: "/titles/state", requestPath: "/titles/request",
    });
  });

  it("ignore un plugin éteint ou un chemin qui sortirait du plugin", () => {
    expect(titleProvider([{ ...vigie, configEnabled: false }])).toBeNull();
    expect(titleProvider([{ ...vigie, titles: { state: "//evil.example/x" } }])).toBeNull();
  });

  it("garde l'état sans la demande quand celle-ci est mal formée", () => {
    const provider = titleProvider([{ ...vigie, titles: { state: "/s", request: "https://x.y" } }]);
    expect(provider).toEqual({ pluginId: "seer", statePath: "/s", requestPath: null });
    expect(titleRequestUrl(provider!)).toBeNull();
  });

  it("forme les URL sous la racine du plugin", () => {
    const provider = titleProvider([vigie])!;
    expect(titleStateUrl(provider, ["movie:603", "tv:1399"], "fr"))
      .toBe("/api/plugins/seer/titles/state?keys=movie%3A603%2Ctv%3A1399&lang=fr");
    expect(titleRequestUrl(provider)).toBe("/api/plugins/seer/titles/request");
  });
});

describe("les clés TMDB", () => {
  it("s'écrivent et se relisent", () => {
    expect(titleKey("tv", 1399)).toBe("tv:1399");
    expect(parseTitleKey("movie:603")).toEqual({ mediaType: "movie", tmdbId: 603 });
    for (const bad of ["series:1", "movie:0", "movie:-3", "movie:1.5", "movie:", "tv:12345678901"]) {
      expect(parseTitleKey(bad), bad).toBeNull();
    }
  });

  it("ramènent « series » au vocabulaire TMDB", () => {
    expect(titleMediaType("series")).toBe("tv");
    expect(titleMediaType("movie")).toBe("movie");
  });
});

describe("la réponse du plugin", () => {
  const keys: TitleKey[] = ["movie:603", "tv:1399", "movie:11"];

  it("valide chaque état, et ne garde que les clés demandées", () => {
    const states = readTitleStates({
      items: {
        "movie:603": { badge: null, request: { mode: "direct", label: "Demander" } },
        "tv:1399": { badge: { label: "En partie", tone: "success" }, request: { mode: "open", label: "Choisir les saisons", href: "/discover?request=tv:1399" } },
        "movie:99": { badge: { label: "Intrus" } },
      },
    }, keys);
    expect([...states.keys()]).toEqual(["movie:603", "tv:1399"]);
    expect(states.get("movie:603")).toEqual({ badge: null, request: { mode: "direct", label: "Demander", href: null } });
    expect(states.get("tv:1399")?.badge).toEqual({ label: "En partie", tone: "success" });
  });

  it("refuse une offre « open » sans lien interne, et un ton inconnu retombe sur neutre", () => {
    const states = readTitleStates({
      items: {
        "movie:603": { badge: { label: "Demandé", tone: "fuchsia" }, request: { mode: "open", label: "Voir", href: "https://x.y" } },
      },
    }, keys);
    expect(states.get("movie:603")).toEqual({ badge: { label: "Demandé", tone: "neutral" }, request: null });
  });

  it("rend une carte vide sur une réponse illisible", () => {
    expect(readTitleStates(null, keys).size).toBe(0);
    expect(readTitleStates({ items: [] }, keys).size).toBe(0);
  });

  it("lit l'issue d'une demande : faite, refusée, ou une page à ouvrir", () => {
    expect(readTitleRequestOutcome({ ok: true, message: "Dune est demandé.", state: { badge: { label: "Demandé", tone: "info" } } }))
      .toEqual({ kind: "done", ok: true, message: "Dune est demandé.", state: { badge: { label: "Demandé", tone: "info" }, request: null } });
    expect(readTitleRequestOutcome({ ok: false, message: "Quota atteint" }))
      .toEqual({ kind: "done", ok: false, message: "Quota atteint", state: null });
    expect(readTitleRequestOutcome({ href: "/discover?request=tv:1399" })).toEqual({ kind: "open", href: "/discover?request=tv:1399" });
    expect(readTitleRequestOutcome({ href: "//evil.example" })).toBeNull();
    expect(readTitleRequestOutcome("oui")).toBeNull();
  });
});
