/**
 * Partager un titre depuis SHAZAM vers Tentacle TV : l'app est proposée dans la feuille de partage (iOS : un
 * lien web et du texte ; Android : `SEND` de texte), le texte arrive dans `/octave/import?shared=` et le
 * registre des lecteurs en fait la recherche du titre. Aucun build natif ici : le texte reste cohérent.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readSharedText } from "@tentacle-tv/shared/octave/mode";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Shazam → Tentacle TV", () => {
  it("iOS : l'extension accepte le lien web ET le texte que Shazam partage", () => {
    const plist = read("ios/ShareToTentacle/Info.plist");
    expect(plist).toMatch(/NSExtensionActivationSupportsWebURLWithMaxCount<\/key>\s*<integer>[1-9]/);
    expect(plist).toMatch(/NSExtensionActivationSupportsText<\/key>\s*<true\/>/);
  });

  it("Android : l'activité principale reçoit le SEND de texte", () => {
    const manifest = read("android/app/src/main/AndroidManifest.xml");
    expect(manifest).toMatch(/android\.intent\.action\.SEND"[\s\S]{0,400}android:mimeType="text\/plain"/);
  });

  it.each([
    "I used Shazam to discover Kiss the Rain by Billie Myers. https://www.shazam.com/track/20066955/kiss-the-rain",
    "https://www.shazam.com/song/1488408568/blinding-lights",
    "J'ai utilisé Shazam pour découvrir Alors on danse de Stromae.\nhttps://www.shazam.com/fr-fr/track/1/alors-on-danse",
    "https://shz.am/t20066955",
  ])("le texte partagé « %s » mène à la recherche", (text) => {
    expect(readSharedText(text)?.kind).toBe("searchTrack");
  });
});
