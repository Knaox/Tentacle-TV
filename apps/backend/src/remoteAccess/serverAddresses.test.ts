import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  direct: { enabled: true, publicUrl: "https://jf.example.com" as string | null, privateUrl: "http://192.168.1.20:8096" as string | null },
  publicUrl: "https://tv.example.com" as string | null,
  // L'interrupteur d'une 1.24.0 d'avant, laissé « coupé » en base : il ne compte plus.
  legacySwitch: "false" as string | undefined,
}));
vi.mock("../services/configStore", () => ({
  getConfigValue: (key: string) => (key === "remote_access_local_url" ? "http://192.168.1.20:3000" : key === "remote_access_enabled" ? h.legacySwitch : undefined),
  getDirectStreamingConfig: () => h.direct,
  getPublicUrl: () => h.publicUrl,
}));

import { directMediaBaseUrl, pairingUrl, publishedPublicUrl } from "./exposure";
import { serverAddresses } from "./serverAddresses";

beforeEach(() => {
  h.direct = { enabled: true, publicUrl: "https://jf.example.com", privateUrl: "http://192.168.1.20:8096" };
  h.publicUrl = "https://tv.example.com";
  h.legacySwitch = "false";
});

describe("serverAddresses", () => {
  it("un client du réseau local reçoit tout", () => {
    expect(serverAddresses(true)).toEqual({
      local: { tentacle: "http://192.168.1.20:3000", jellyfin: "http://192.168.1.20:8096" },
      public: { tentacle: "https://tv.example.com", jellyfin: "https://jf.example.com" },
    });
  });

  it("Internet ne reçoit pas le plan du domicile", () => {
    expect(serverAddresses(false).local).toEqual({ tentacle: null, jellyfin: null });
  });

  it("sans lecture directe, aucune adresse de Jellyfin", () => {
    h.direct = { ...h.direct, enabled: false };
    expect(serverAddresses(true)).toMatchObject({ local: { jellyfin: null }, public: { jellyfin: null } });
  });

  it("ce qui est réglé est publié, comme en 1.23.0 — même avec l'ancien interrupteur « coupé » en base", () => {
    for (const legacy of ["false", undefined, "true"]) {
      h.legacySwitch = legacy;
      expect(publishedPublicUrl()).toBe("https://tv.example.com");
      expect(serverAddresses(false).public).toEqual({ tentacle: "https://tv.example.com", jellyfin: "https://jf.example.com" });
      expect(pairingUrl()).toBe("https://tv.example.com");
    }
  });

  it("sans lien public : rien de public, et le jumelage d'une TV prend l'adresse privée de ce serveur", () => {
    h.publicUrl = null;
    expect(serverAddresses(true).public.tentacle).toBeNull();
    expect(pairingUrl()).toBe("http://192.168.1.20:3000");
  });

  it("le jumelage branché sur les réglages : la requête du client ne sert qu'à défaut", () => {
    const view = { clientIsPrivate: true, protocol: "http", host: "nas.local:3000" };
    expect(pairingUrl(view)).toBe("https://tv.example.com");
  });
});

describe("l'adresse de lecture directe donnée à un client", () => {
  it("à la maison, l'adresse privée ; ailleurs, la publique si elle est publiée", () => {
    expect(directMediaBaseUrl(true)).toBe("http://192.168.1.20:8096");
    expect(directMediaBaseUrl(false)).toBe("https://jf.example.com");
  });

  it("l'adresse publique de Jellyfin est FACULTATIVE : sans elle, la maison lit en direct, l'extérieur par Tentacle", () => {
    h.direct = { ...h.direct, publicUrl: null };
    expect(directMediaBaseUrl(true)).toBe("http://192.168.1.20:8096");
    expect(directMediaBaseUrl(false)).toBeNull();
  });

  it("les deux adresses de 1.23.0 donnent exactement ce que 1.23.0 donnait, quel que soit l'ancien interrupteur", () => {
    for (const legacy of ["false", undefined]) {
      h.legacySwitch = legacy;
      expect(directMediaBaseUrl(true)).toBe("http://192.168.1.20:8096");
      expect(directMediaBaseUrl(false)).toBe("https://jf.example.com");
    }
  });

  it("sans adresse privée ou lecture directe coupée : personne ne lit en direct", () => {
    h.direct = { ...h.direct, privateUrl: null };
    expect(directMediaBaseUrl(true)).toBeNull();
    h.direct = { enabled: false, publicUrl: "https://jf.example.com", privateUrl: "http://192.168.1.20:8096" };
    expect(directMediaBaseUrl(false)).toBeNull();
  });
});
