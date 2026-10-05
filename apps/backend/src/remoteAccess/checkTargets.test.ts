import { describe, expect, it } from "vitest";
import { planCheckTargets } from "./checkTargets";

describe("planCheckTargets", () => {
  it("sans lien public : le port de Tentacle sur l'adresse nue", () => {
    expect(planCheckTargets({ publicUrl: null, jellyfinPublicUrl: null, proxy: "none", hostPort: 3471 })).toEqual([
      { service: "tentacle", scheme: "http", port: 3471 },
    ]);
  });

  it("derrière un mandataire : HTTPS d'abord, puis le port 80 des mêmes domaines", () => {
    expect(
      planCheckTargets({ publicUrl: "https://TV.example.com/", jellyfinPublicUrl: "https://jf.example.com", proxy: "caddy", hostPort: 3000 }),
    ).toEqual([
      { service: "tentacle", scheme: "https", port: 443, host: "tv.example.com" },
      { service: "jellyfin", scheme: "https", port: 443, host: "jf.example.com" },
      { service: "tentacle", scheme: "http", port: 80, host: "tv.example.com" },
      { service: "jellyfin", scheme: "http", port: 80, host: "jf.example.com" },
    ]);
  });

  it("sans mandataire, un lien https:// ne double pas le port 80", () => {
    expect(planCheckTargets({ publicUrl: "https://tv.example.com", jellyfinPublicUrl: null, proxy: "none", hostPort: 3000 })).toHaveLength(1);
  });

  it("une adresse IP nue n'a pas de nom ; un port hors liste n'est pas testé", () => {
    expect(planCheckTargets({ publicUrl: "http://203.0.113.5:3000", jellyfinPublicUrl: "http://[2001:db8::5]:8096", proxy: "none", hostPort: 3000 })).toEqual([
      { service: "tentacle", scheme: "http", port: 3000 },
      { service: "jellyfin", scheme: "http", port: 8096 },
    ]);
    // Le port 22 n'est pas testable : on retombe sur le port de l'hôte.
    expect(planCheckTargets({ publicUrl: "http://tv.example.com:22", jellyfinPublicUrl: null, proxy: "none", hostPort: 3000 })).toEqual([
      { service: "tentacle", scheme: "http", port: 3000 },
    ]);
  });
});
