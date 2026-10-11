import { describe, expect, it } from "vitest";
import { parseHostOptions } from "./hostOptions";
import { newestManifest } from "./jellyfin/installer/versionPick";

describe("réglages du paquet", () => {
  it("l'installation guidée est ouverte sauf si le paquet la coupe", () => {
    expect(parseHostOptions(null)).toEqual({ jellyfinInstaller: true });
    expect(parseHostOptions("{}")).toEqual({ jellyfinInstaller: true });
    expect(parseHostOptions('{ "jellyfinInstaller": false }')).toEqual({ jellyfinInstaller: false });
    expect(parseHostOptions("pas du json")).toEqual({ jellyfinInstaller: true });
  });
});

describe("manifeste de compatibilité", () => {
  it("garde la révision la plus haute, et ignore l'illisible", () => {
    expect(newestManifest(['{"revision":1,"a":1}', '{"revision":3,"a":3}', null, "{"])).toEqual({ revision: 3, a: 3 });
    expect(newestManifest([null])).toBeNull();
  });
});
