import { describe, expect, it } from "vitest";
import { clientJellyfinUrl } from "./clientUrl";

const full = { siblingUrl: "http://jellyfin:8096", jellyfinHostPort: 47896 };
const other = { siblingUrl: null, jellyfinHostPort: null };

describe("l'adresse de Jellyfin donnée aux applications", () => {
  it("pile complète : l'hôte du navigateur et le port PUBLIÉ, jamais le nom Docker", () => {
    expect(clientJellyfinUrl({ deployment: full, browserHost: "172.16.1.30" })).toBe("http://172.16.1.30:47896");
    expect(clientJellyfinUrl({ deployment: full, browserHost: "nas.local", jellyfinUrl: "http://jellyfin:8096" })).toBe("http://nas.local:47896");
  });

  it("pile complète sans port publié déclaré : rien plutôt que 8096 supposé", () => {
    expect(clientJellyfinUrl({ deployment: { ...full, jellyfinHostPort: null }, browserHost: "172.16.1.30" })).toBeNull();
  });

  it("IPv6 : l'hôte entre crochets", () => {
    expect(clientJellyfinUrl({ deployment: full, browserHost: "[fd00::5]" })).toBe("http://[fd00::5]:47896");
  });

  it("un Jellyfin choisi sur le réseau local garde son adresse", () => {
    expect(clientJellyfinUrl({ deployment: other, browserHost: "172.16.1.30", jellyfinUrl: "http://172.16.1.40:8096" })).toBe("http://172.16.1.40:8096");
  });

  it("une adresse que seul le serveur joint prend l'hôte du navigateur, port gardé", () => {
    expect(clientJellyfinUrl({ deployment: other, browserHost: "172.16.1.30", jellyfinUrl: "http://127.0.0.1:8920" })).toBe("http://172.16.1.30:8920");
    expect(clientJellyfinUrl({ deployment: other, browserHost: "172.16.1.30", jellyfinUrl: "http://host.docker.internal:8097" })).toBe("http://172.16.1.30:8097");
    expect(clientJellyfinUrl({ deployment: other, browserHost: "172.16.1.30", jellyfinUrl: "http://jellyfin:8096" })).toBe("http://172.16.1.30:8096");
  });

  it("un hôte de navigateur douteux n'entre pas dans l'adresse", () => {
    expect(clientJellyfinUrl({ deployment: full, browserHost: "evil/path" })).toBeNull();
    expect(clientJellyfinUrl({ deployment: other, jellyfinUrl: "http://127.0.0.1:8096", browserHost: undefined })).toBeNull();
  });
});
