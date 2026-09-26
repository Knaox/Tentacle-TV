/**
 * Le lien d'invitation sortira-t-il du réseau local ? C'est ce qui décide
 * d'avertir l'administrateur avant qu'il envoie un lien mort.
 */

import { describe, expect, it } from "vitest";
import { isLocalOnlyUrl } from "./inviteLink";

describe("isLocalOnlyUrl", () => {
  it("les adresses du réseau local", () => {
    for (const url of [
      "http://localhost:3000", "http://127.0.0.1:3001", "http://192.168.1.20:3000", "http://10.0.0.5",
      "http://172.20.1.1", "http://169.254.3.4", "http://[::1]:3000", "http://[fd12:3456::1]",
      "http://[fe80::1]", "http://nas:3000", "http://tentacle.local", "http://media.home.arpa",
    ]) {
      expect(isLocalOnlyUrl(url), url).toBe(true);
    }
  });

  it("les adresses joignables d'ailleurs", () => {
    for (const url of [
      "https://tv.example.com", "https://poulpy.tentacletv.app", "http://82.64.10.3:3000",
      "http://172.32.0.1", "http://[2001:db8::1]",
    ]) {
      expect(isLocalOnlyUrl(url), url).toBe(false);
    }
  });

  it("ne tranche pas sur une adresse illisible", () => {
    expect(isLocalOnlyUrl("")).toBe(false);
    expect(isLocalOnlyUrl("pas une url")).toBe(false);
  });
});
