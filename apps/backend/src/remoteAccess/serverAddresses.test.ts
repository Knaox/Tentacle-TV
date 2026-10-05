import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ direct: { enabled: true, publicUrl: "https://jf.example.com", privateUrl: "http://192.168.1.20:8096" } }));
vi.mock("../services/configStore", () => ({
  getConfigValue: (key: string) => (key === "remote_access_local_url" ? "http://192.168.1.20:3000" : undefined),
  getDirectStreamingConfig: () => h.direct,
  getPublicUrl: () => "https://tv.example.com",
}));

import { serverAddresses } from "./serverAddresses";

beforeEach(() => {
  h.direct = { enabled: true, publicUrl: "https://jf.example.com", privateUrl: "http://192.168.1.20:8096" };
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
});
