import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * « Accès à Octave » suivi depuis Tentacle : une souscription aux événements
 * `music:*` (socket partagé), seulement face à un serveur qui déclare
 * `octave.rights` — un serveur d'avant n'en reçoit aucune de plus.
 */
const h = vi.hoisted(() => ({ rights: true, music: true, calls: [] as { enabled: boolean; token: string | null | undefined }[] }));

vi.mock("@tentacle-tv/api-client", () => ({
  useJellyfinClient: () => ({ getAccessToken: () => "jeton" }),
  useMusicCapability: () => h.music,
  useServerCapability: (key: string) => key === "octave.rights" && h.rights,
  useMusicEvents: (options: { enabled: boolean; token?: string | null }) => void h.calls.push({ enabled: options.enabled, token: options.token }),
}));

const { useOctaveAccessLive } = await import("./useOctaveAccessLive");

beforeEach(() => {
  h.rights = true;
  h.music = true;
  h.calls = [];
});

describe("useOctaveAccessLive", () => {
  it("serveur qui déclare le droit : écoute, avec le jeton de la page", () => {
    useOctaveAccessLive(true);
    expect(h.calls).toEqual([{ enabled: true, token: "jeton" }]);
  });

  it("serveur d'avant, sans musique, ou dans Octave : rien", () => {
    h.rights = false;
    useOctaveAccessLive(true);
    h.rights = true;
    h.music = false;
    useOctaveAccessLive(true);
    h.music = true;
    useOctaveAccessLive(false);
    expect(h.calls.map((call) => call.enabled)).toEqual([false, false, false]);
  });
});
