import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  direct: { enabled: true, publicUrl: "https://jf.example.com" as string | null, privateUrl: "http://192.168.1.20:8096" as string | null },
  exposed: "true" as string | undefined,
}));
vi.mock("../services/configStore", () => ({
  getConfigValue: (key: string) => (key === "remote_access_local_url" ? "http://192.168.1.20:3000" : key === "remote_access_enabled" ? h.exposed : undefined),
  getDirectStreamingConfig: () => h.direct,
  getPublicUrl: () => "https://tv.example.com",
}));

import { directMediaBaseUrl, publishedPublicUrl } from "./exposure";
import { serverAddresses } from "./serverAddresses";

beforeEach(() => {
  h.direct = { enabled: true, publicUrl: "https://jf.example.com", privateUrl: "http://192.168.1.20:8096" };
  h.exposed = "true";
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

  it("« Accès depuis l'extérieur » coupé (ou jamais allumé) : rien de public — le local, lui, ne change pas", () => {
    for (const off of ["false", undefined]) {
      h.exposed = off;
      expect(serverAddresses(true)).toEqual({
        local: { tentacle: "http://192.168.1.20:3000", jellyfin: "http://192.168.1.20:8096" },
        public: { tentacle: null, jellyfin: null },
      });
      expect(publishedPublicUrl()).toBeNull();
    }
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

  it("accès extérieur coupé : la publique n'est jamais donnée, la privée toujours", () => {
    h.exposed = "false";
    expect(directMediaBaseUrl(true)).toBe("http://192.168.1.20:8096");
    expect(directMediaBaseUrl(false)).toBeNull();
  });

  it("sans adresse privée ou lecture directe coupée : personne ne lit en direct", () => {
    h.direct = { ...h.direct, privateUrl: null };
    expect(directMediaBaseUrl(true)).toBeNull();
    h.direct = { enabled: false, publicUrl: "https://jf.example.com", privateUrl: "http://192.168.1.20:8096" };
    expect(directMediaBaseUrl(false)).toBeNull();
  });
});
