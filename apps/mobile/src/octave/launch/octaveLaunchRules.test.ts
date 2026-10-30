import { describe, expect, it } from "vitest";
import { decideMobileOctaveLaunch, mirrorSaysAvailable, octaveOwnerOf } from "./octaveLaunchRules";

const NOW = 1_800_000_000_000;
const USER = JSON.stringify({ Id: "u1", Name: "Knaoxtest" });
const OWNER = "https://srv|u1";
const base = { tentacle_server_url: "https://srv", tentacle_user: USER };

describe("lancement du mobile en Octave", () => {
  it("quitté en Octave : lancement dans Octave, sur l'ACCUEIL d'Octave — jamais la page gardée (lot « fl »)", () => {
    const page = JSON.stringify({ owner: OWNER, path: "/octave/album/a1", scrollTop: 320, savedAt: NOW - 1000 });
    const launch = decideMobileOctaveLaunch({ ...base, tentacle_octave_mode: "1", tentacle_octave_page: page }, NOW);
    expect(launch.inOctave).toBe(true);
    expect(launch.path).toBe("/octave");
    expect(launch.owner).toBe(OWNER);
  });

  it("quitté en Tentacle : rien ne change (animation d'ouverture comprise)", () => {
    const launch = decideMobileOctaveLaunch({ ...base }, NOW);
    expect(launch.inOctave).toBe(false);
    expect(launch.path).toBeNull();
  });

  it("la page d'une AUTRE identité ne se rouvre pas : l'accueil d'Octave", () => {
    const page = JSON.stringify({ owner: "https://srv|other", path: "/octave/search?q=x", scrollTop: 0, savedAt: NOW });
    expect(decideMobileOctaveLaunch({ ...base, tentacle_octave_mode: "1", tentacle_octave_page: page }, NOW).path).toBe("/octave");
  });

  it("« Au démarrage, ouvrir » : toujours Tentacle, même quitté en Octave", () => {
    expect(decideMobileOctaveLaunch({ ...base, tentacle_octave_mode: "1", tentacle_octave_startup: "tentacle" }, NOW).inOctave).toBe(false);
    expect(decideMobileOctaveLaunch({ ...base, tentacle_octave_startup: "octave" }, NOW).inOctave).toBe(true);
  });

  it("Octave connu indisponible pour ce compte, ou sans session : Tentacle", () => {
    const mirror = JSON.stringify({ owner: OWNER, available: false });
    expect(decideMobileOctaveLaunch({ ...base, tentacle_octave_mode: "1", tentacle_octave_launch: mirror }, NOW).inOctave).toBe(false);
    expect(decideMobileOctaveLaunch({ tentacle_server_url: "https://srv", tentacle_octave_mode: "1" }, NOW).inOctave).toBe(false);
  });

  it("valeurs illisibles : jamais une exception", () => {
    expect(octaveOwnerOf("https://srv", "{pas du json")).toBeNull();
    const launch = decideMobileOctaveLaunch({ ...base, tentacle_octave_mode: "1", tentacle_octave_page: "{", tentacle_octave_launch: "[" }, NOW);
    expect(launch.path).toBe("/octave");
  });

  it("le miroir ne vaut que pour son identité", () => {
    expect(mirrorSaysAvailable({ owner: OWNER, available: true }, OWNER)).toBe(true);
    expect(mirrorSaysAvailable({ owner: OWNER, available: true }, "https://srv|u2")).toBe(false);
    expect(mirrorSaysAvailable(null, OWNER)).toBe(false);
  });
});
