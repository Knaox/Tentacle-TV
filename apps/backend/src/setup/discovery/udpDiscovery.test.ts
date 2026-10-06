import { describe, expect, it } from "vitest";
import { readReply } from "./udpDiscovery";

const from = (address: string) => ({ address, family: "IPv4" as const, port: 7359, size: 0 });
const reply = (json: unknown) => Buffer.from(JSON.stringify(json));

describe("les réponses de la découverte UDP", () => {
  it("l'adresse vient de l'expéditeur, le port de l'annonce", () => {
    // Un Jellyfin en conteneur annonce son IP Docker : seule compte celle d'où il répond.
    expect(readReply(reply({ Address: "http://172.19.0.3:8096", Id: "abc", Name: "Salon" }), from("172.16.1.30"))).toEqual({
      host: "172.16.1.30",
      port: 8096,
      protocol: "http:",
    });
    expect(readReply(reply({ Address: "https://nas:8920", Id: "abc" }), from("192.168.1.9"))).toMatchObject({ port: 8920, protocol: "https:" });
  });

  it("adresse annoncée illisible : 8096 en http", () => {
    expect(readReply(reply({ Address: "???", Id: "abc" }), from("10.0.0.2"))).toEqual({ host: "10.0.0.2", port: 8096, protocol: "http:" });
  });

  it("pas un Jellyfin, ou trop gros : ignoré", () => {
    expect(readReply(Buffer.from("hello"), from("10.0.0.2"))).toBeNull();
    expect(readReply(reply({ Address: "http://x:1" }), from("10.0.0.2"))).toBeNull();
    expect(readReply(Buffer.alloc(5000, 32), from("10.0.0.2"))).toBeNull();
  });
});
