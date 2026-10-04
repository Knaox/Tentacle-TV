import { describe, expect, it } from "vitest";
import { i18n, initI18n } from "@tentacle-tv/shared";
import { ANDROIDTV_BINDINGS } from "./androidtv";
import { BASE_REMOTE_HINTS, REMOTE_HINT_IDS } from "./hints";
import { TVOS_BINDINGS } from "./tvos";

/**
 * Les indications de touches : chaque table dit chaque indication, et chaque
 * clé qu'elle choisit existe dans les deux langues — une clé manquante
 * afficherait son nom technique à l'écran, sans erreur.
 */
const TABLES = [TVOS_BINDINGS, ANDROIDTV_BINDINGS];

initI18n({ lng: "fr" });

describe("indications de touches", () => {
  it("chaque table nomme chaque indication, et rien d'autre", () => {
    for (const table of TABLES) expect(Object.keys(table.hints).sort(), table.platform).toEqual([...REMOTE_HINT_IDS].sort());
  });

  it("chaque clé choisie existe en français et en anglais", () => {
    for (const table of TABLES) {
      for (const [id, key] of Object.entries(table.hints)) {
        if (key === null) continue;
        for (const lng of ["fr", "en"]) expect(i18n.exists(key, { lng }), `${table.platform} ${id} → ${key} (${lng})`).toBe(true);
      }
    }
  });

  it("Apple TV garde ses mots d'avant la table, tels quels", () => {
    expect(TVOS_BINDINGS.hints).toBe(BASE_REMOTE_HINTS);
    expect(TVOS_BINDINGS.hints.holdForOptions).toBe("cards:holdForOptions");
    expect(TVOS_BINDINGS.hints.seasonsShortcut).toBe("requests:seasonsShortcut");
  });

  it("Android TV ne change que le raccourci des saisons (Lecture/Pause n'est pas sur toutes ses télécommandes)", () => {
    const changed = REMOTE_HINT_IDS.filter((id) => ANDROIDTV_BINDINGS.hints[id] !== BASE_REMOTE_HINTS[id]);
    expect(changed).toEqual(["seasonsShortcut"]);
    expect(ANDROIDTV_BINDINGS.traits.playPauseKey).toBe("sometimes");
  });
});
