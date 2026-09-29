import { describe, expect, it } from "vitest";
import { corsOriginsToInject } from "./jellyfinCors";

describe("corsOriginsToInject", () => {
  it("l'origine de la page ET celle du lien public", () => {
    expect(corsOriginsToInject("http://192.168.1.20:3000", "https://tv.example.com/"))
      .toEqual(["http://192.168.1.20:3000", "https://tv.example.com"]);
  });

  it("une seule fois quand elles se confondent, sans chemin", () => {
    expect(corsOriginsToInject("https://tv.example.com", "https://tv.example.com/tentacle")).toEqual(["https://tv.example.com"]);
  });

  it("ni origine opaque, ni adresse illisible, ni rien", () => {
    expect(corsOriginsToInject("null", "pas une adresse")).toEqual([]);
    expect(corsOriginsToInject(undefined, null)).toEqual([]);
  });
});
