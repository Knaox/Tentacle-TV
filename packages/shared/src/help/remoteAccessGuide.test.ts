import { describe, expect, it } from "vitest";
import frHelp from "../i18n/locales/fr/remoteAccessHelp";
import enHelp from "../i18n/locales/en/remoteAccessHelp";
import { REMOTE_ACCESS_DOCS, REMOTE_ACCESS_GUIDE, remoteAccessDocLabelKey } from "./remoteAccessGuide";

describe("guide de l'accès à distance", () => {
  it("chaque clé citée existe dans les deux langues", () => {
    for (const table of [frHelp, enHelp] as Array<Record<string, string>>) {
      for (const section of REMOTE_ACCESS_GUIDE) {
        for (const key of [section.titleKey, ...section.paragraphKeys, ...section.links.map(remoteAccessDocLabelKey)]) {
          expect(table[key], key).toBeTruthy();
        }
      }
    }
  });

  it("des liens officiels en https://, et chacun sert", () => {
    const used = new Set(REMOTE_ACCESS_GUIDE.flatMap((s) => s.links));
    for (const [doc, url] of Object.entries(REMOTE_ACCESS_DOCS)) {
      expect(new URL(url).protocol, doc).toBe("https:");
      expect(used.has(doc as keyof typeof REMOTE_ACCESS_DOCS), doc).toBe(true);
    }
  });
});
