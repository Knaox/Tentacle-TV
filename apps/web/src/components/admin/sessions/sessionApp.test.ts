import { describe, expect, it } from "vitest";
import { sessionApp, sessionAppText, sessionDeviceName } from "./sessionApp";

/** Les identités réelles des clients Tentacle (`JellyfinClient` de chaque appli). */
const line = (client: string, deviceName: string, applicationVersion: string) =>
  sessionAppText(sessionApp({ client, deviceName, applicationVersion }));

describe("sessionApp", () => {
  it("nomme chaque client Tentacle et sa version, sans redite", () => {
    expect(line("Tentacle TV - Desktop", "Desktop", "1.22.0")).toBe("Tentacle Desktop 1.22.0");
    expect(line("Tentacle TV - Web", "Web", "1.19.0")).toBe("Tentacle Web 1.19.0");
    expect(line("Tentacle TV - Mobile", "Tentacle-iOS", "1.6.0")).toBe("Tentacle Mobile 1.6.0 · iOS");
    expect(line("Tentacle TV - Mobile", "Tentacle-Android", "1.6.0")).toBe("Tentacle Mobile 1.6.0 · Android");
    expect(line("Tentacle TV - TV", "AndroidTV", "1.5.2")).toBe("Tentacle TV 1.5.2 · Android TV");
    expect(line("Tentacle TV - TV", "Apple TV", "1.5.2")).toBe("Tentacle TV 1.5.2 · Apple TV");
    expect(line("Tentacle TV - webOS", "LG TV", "1.3.0")).toBe("Tentacle webOS 1.3.0 · LG TV");
  });

  it("garde le nom qu'un administrateur a donné à l'appareil", () => {
    expect(line("Tentacle TV - Desktop", "PC du salon", "1.22.0")).toBe("Tentacle Desktop 1.22.0 · PC du salon");
  });

  it("laisse un autre client tel qu'il se présente", () => {
    expect(line("Jellyfin Web", "Firefox", "10.11.8")).toBe("Jellyfin Web 10.11.8 · Firefox");
    // Nos noms d'appareil ne se traduisent que pour nos clients.
    expect(line("Infuse", "AndroidTV", "8.1")).toBe("Infuse 8.1 · AndroidTV");
  });

  it("n'invente rien de ce que Jellyfin n'a pas dit", () => {
    expect(sessionApp({ client: "Tentacle TV - TV", deviceName: "Salon", applicationVersion: "  " }).version).toBeNull();
    expect(line("Tentacle TV - TV", "Salon", "")).toBe("Tentacle TV · Salon");
    expect(line("", "Firefox", "")).toBe("Firefox");
    expect(line("", "", "")).toBe("");
  });

  it("nomme l'appareil par lui-même, à défaut par l'application", () => {
    expect(sessionDeviceName(sessionApp({ client: "Tentacle TV - TV", deviceName: "AndroidTV", applicationVersion: "1" }))).toBe("Android TV");
    expect(sessionDeviceName(sessionApp({ client: "Tentacle TV - Desktop", deviceName: "Desktop", applicationVersion: "1" }))).toBe("Tentacle Desktop");
  });
});
