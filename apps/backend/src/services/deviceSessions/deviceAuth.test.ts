import { describe, expect, it } from "vitest";
import { deviceAuthHeader, tokenOnlyAuthHeader } from "./deviceAuth";

/**
 * L'en-tête que le canal présente à Jellyfin : le jeton seul pour un appareil
 * qui s'est authentifié lui-même, l'identité dérivée pour un appareil jumelé.
 */
describe("deviceAuthHeader", () => {
  it("un appareil authentifié ne présente que son jeton", () => {
    expect(deviceAuthHeader({ token: "abc123" })).toBe('MediaBrowser Token="abc123"');
  });

  it("un appareil jumelé présente son identité, sa version et le jeton emprunté", () => {
    const header = deviceAuthHeader({
      token: "abc123",
      identity: { client: "Tentacle TV - TV", device: "Apple TV", deviceId: "tentacle-ab12-paired-0f0f", version: "1.3.0" },
    });
    expect(header).toBe(
      'MediaBrowser Client="Tentacle TV - TV", Device="Apple TV", DeviceId="tentacle-ab12-paired-0f0f", Version="1.3.0", Token="abc123"',
    );
  });

  it("rien ne peut refermer un guillemet ni greffer un second jeton", () => {
    const header = deviceAuthHeader({
      token: 'x", Token="vol',
      identity: { client: 'TV", Token="vol', device: "Salon é", deviceId: 'id"x', version: "1.3.0" },
    });
    // Ce que Jellyfin en LIT : un seul Token, et les étiquettes restent des valeurs.
    const parts = jellyfinParts(header.replace(/^MediaBrowser /, ""));
    expect(parts.Token).toBe("xTokenvol");
    expect(parts.Client).toBe("TV, Token=vol");
    expect(parts.Device).toBe("Salon ");
    expect(parts.DeviceId).toBe("idx");
    expect(tokenOnlyAuthHeader('a"b')).toBe('MediaBrowser Token="ab"');
  });
});

/** Port fidèle de `AuthorizationContext.GetParts` (Jellyfin 10.11) : une
 *  virgule ou un « = » entre guillemets n'y sépare rien. */
function jellyfinParts(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  let escaped = false;
  let start = 0;
  let key = "";
  let i = 0;
  const value = (from: number, to: number) => decodeURIComponent(header.slice(from, to).trim().replace(/^"+|"+$/g, ""));
  for (; i < header.length; i++) {
    const token = header[i];
    if (token === '"' || token === ",") {
      escaped = !escaped === (token === '"');
      if (token === "," && !escaped) {
        if (start < i) {
          result[key] = value(start, i);
          key = "";
        }
        start = i + 1;
      }
    } else if (!escaped && token === "=") {
      key = header.slice(start, i).trim();
      start = i + 1;
    }
  }
  if (start < i) result[key] = value(start, i);
  return result;
}
