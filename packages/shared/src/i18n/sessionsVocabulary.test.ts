import { describe, expect, it } from "vitest";
import fr from "./locales/fr/sessions";
import en from "./locales/en/sessions";
import { REASONS_WITH_DETAILS, TRANSCODE_REASONS, explainPlayback } from "../adminSessions/explain";
import type { AdminSessionDto } from "../types/adminSessionsDto";
import { SERVER_CAPABILITY_KEYS } from "../serverCapabilities/serverCapabilities";

/**
 * L'espace `sessions` est lu par le tableau de bord du bureau ET du mobile :
 * mêmes clés dans les deux langues, aucun « téléchargement » (garde-fou du
 * mobile), et une phrase pour CHAQUE raison de transcodage que la règle
 * partagée sait dire — avec, pour les raisons à détails, la forme générique et
 * exactement les détails que la règle fournit.
 */

const FORBIDDEN = /t[ée]l[ée]charg|download/i;

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === "string") out[`${prefix}${key}`] = value;
    else Object.assign(out, flatten(value, `${prefix}${key}.`));
  }
  return out;
}

const FR = flatten(fr as unknown as Tree);
const EN = flatten(en as unknown as Tree);

const placeholders = (text: string): string[] => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

/** Une lecture où chaque détail est connu : la règle remplit tous ses paramètres. */
function paramsFor(reason: string): string[] {
  const session: Pick<AdminSessionDto, "playMethod" | "transcoding" | "nowPlaying" | "source"> = {
    playMethod: "Transcode",
    nowPlaying: { itemId: "i", name: "Dune", type: "Movie", imageItemId: "i" },
    source: {
      container: "mkv", videoCodec: "hevc", videoProfile: "Main 10", videoBitDepth: 10, width: 3840, height: 2160,
      videoRange: "HDR10", audioCodec: "truehd", audioChannels: 8, subtitleCodec: "PGSSUB",
    },
    transcoding: { isVideoDirect: false, isAudioDirect: false, reasons: [reason] },
  };
  return Object.keys(explainPlayback(session, "fr", new Set(SERVER_CAPABILITY_KEYS)).reasons[0]?.params ?? {}).sort();
}

describe("vocabulaire des sessions", () => {
  it("les deux langues portent les mêmes clés", () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(FR).sort());
  });

  it("aucun « téléchargement » : le mobile lit cet espace", () => {
    for (const [key, text] of [...Object.entries(FR), ...Object.entries(EN)]) {
      expect(text, key).not.toMatch(FORBIDDEN);
    }
  });

  it.each(TRANSCODE_REASONS.filter((r) => r !== "VideoBitrateNotSupported"))("%s a sa phrase, détails compris", (reason) => {
    for (const table of [FR, EN]) {
      const text = table[`reason.${reason}`];
      expect(text, `reason.${reason}`).toBeTruthy();
      expect(placeholders(text)).toEqual(paramsFor(reason));
      if (REASONS_WITH_DETAILS.has(reason)) {
        const generic = table[`reason.${reason}_generic`];
        expect(generic, `reason.${reason}_generic`).toBeTruthy();
        expect(placeholders(generic)).toEqual([]);
      }
    }
  });

  it("plus de code d'épisode à accent : la règle partagée l'écrit « S1 E1 »", () => {
    for (const text of [...Object.values(FR), ...Object.values(EN)]) {
      expect(text).not.toMatch(/\{\{season\}\}|É\{\{/);
    }
  });
});
