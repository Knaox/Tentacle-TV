import { describe, expect, it } from "vitest";
import type { JellyfinProbeResult } from "@tentacle-tv/shared";
import { groupServers, hostAndPort, isValidClientUrl, mergeServers, recommendedUrl, serverState, withManual, withSelection } from "./jellyfinChoice";

const jf = (url: string, blank: boolean, compatible = true): JellyfinProbeResult => ({
  url, serverId: url, version: "10.11.11", serverName: "x", blank, inStack: false, compatible, clientUrl: url,
});

describe("le choix de Jellyfin", () => {
  it("le CONSEILLÉ : le neuf, même après un configuré ; aucun s'il n'y a que des déjà configurés, jamais un incompatible", () => {
    expect(recommendedUrl([jf("http://a:8096", false), jf("http://b:47896", true)])).toBe("http://b:47896");
    expect(recommendedUrl([jf("http://a:8096", true, false), jf("http://b:8097", false)])).toBeNull();
    expect(recommendedUrl([jf("http://a:8096", true, false)])).toBeNull();
    expect(recommendedUrl([])).toBeNull();
  });

  it("pile complète : le sien est conseillé, même déjà configuré, sauf s'il n'est pas pris en charge", () => {
    const stack = { ...jf("http://jellyfin:8096", false), inStack: true };
    expect(recommendedUrl([jf("http://a:8097", true), stack])).toBe("http://jellyfin:8096");
    expect(recommendedUrl([{ ...stack, compatible: false }, jf("http://a:8097", true)])).toBe("http://a:8097");
  });

  it("le Jellyfin déjà choisi reste dans la liste, dans l'état de SON parcours", () => {
    const selection = { url: "http://a:8097", serverId: "http://a:8097", serverName: "x", version: "10.11.11", inStack: false, path: "fresh" as const };
    // Son compte vient d'être créé : Jellyfin le dit configuré, le parcours reste « neuf ».
    expect(withSelection([jf("http://a:8097", false)], selection, null)).toEqual([jf("http://a:8097", true)]);
    // Absent de la recherche (adresse saisie à la main) : il revient en tête.
    expect(withSelection([jf("http://b:8096", false)], { ...selection, path: "configured" }, "http://a:8097").map((s) => [s.url, s.blank])).toEqual([
      ["http://a:8097", false],
      ["http://b:8096", false],
    ]);
    expect(withSelection([jf("http://b:8096", false)], null, null)).toEqual([jf("http://b:8096", false)]);
  });

  it("une seule liste : celui de la pile en tête, chaque serveur une fois (même vu par son port publié)", () => {
    const stack = { ...jf("http://jellyfin:8096", true), serverId: "pile", inStack: true };
    const published = { ...jf("http://172.16.1.30:47896", false), serverId: "pile" };
    const found = [jf("http://172.16.1.30:8097", true), published, jf("http://172.16.1.30:8096", false)];
    const list = mergeServers(stack, found, [jf("http://172.16.1.30:8096", false), jf("http://10.0.0.9:8096", false)]);
    expect(list.map((s) => s.url)).toEqual(["http://jellyfin:8096", "http://172.16.1.30:8097", "http://172.16.1.30:8096", "http://10.0.0.9:8096"]);
  });

  it("rangés pour distinguer les neufs des déjà configurés", () => {
    const stack = { ...jf("http://jellyfin:8096", true), inStack: true };
    const groups = groupServers([jf("http://c:8096", false), stack, jf("http://n:8097", true), jf("http://old:8096", true, false)]);
    expect(groups.stack?.url).toBe("http://jellyfin:8096");
    expect(groups.fresh.map((s) => s.url)).toEqual(["http://n:8097"]);
    expect(groups.configured.map((s) => s.url)).toEqual(["http://c:8096"]);
    expect(groups.incompatible.map((s) => s.url)).toEqual(["http://old:8096"]);
  });

  it("chaque entrée dit son adresse, son port et son état en toutes lettres", () => {
    expect(hostAndPort("http://172.16.1.30:47896")).toEqual({ host: "172.16.1.30", port: "47896" });
    expect(hostAndPort("https://jf.example.com")).toEqual({ host: "jf.example.com", port: "443" });
    expect(serverState(jf("http://a", true))).toBe("blank");
    expect(serverState(jf("http://a", false))).toBe("configured");
    expect(serverState(jf("http://a", true, false))).toBe("incompatible");
  });

  it("une adresse saisie rejoint la liste en tête, une seule fois", () => {
    const list = withManual([jf("http://a:8096", false), jf("http://b:8097", true)], jf("http://a:8096", false));
    expect(list.map((s) => s.url)).toEqual(["http://a:8096", "http://b:8097"]);
  });

  it("l'adresse des applications : http(s), sans identifiants", () => {
    expect(isValidClientUrl("http://172.16.1.30:47896")).toBe(true);
    expect(isValidClientUrl("https://jf.example.com")).toBe(true);
    expect(isValidClientUrl("jellyfin:8096")).toBe(false);
    expect(isValidClientUrl("http://u:p@host")).toBe(false);
    expect(isValidClientUrl("ftp://host")).toBe(false);
  });
});
