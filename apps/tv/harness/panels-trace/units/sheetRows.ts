import { resolveCardOverlay, type CardOverlayVariant } from "@tentacle-tv/shared";
import { sheetRows } from "@bench/src/redesignWiring/sheet/sheetRows";
import { translate } from "../stubs/i18n";

/** Les pictos du grand panneau (`sheetRows`), sur toutes les combinaisons qui comptent. */
export function runSheetRows(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const variants: CardOverlayVariant[] = ["poster", "landscape", "reco"];
  for (const variant of variants) {
    for (const inLibrary of [true, false]) {
      for (const playable of [true, false]) {
        for (const resume of [false, true]) {
          for (const providerFilterActive of [false, true]) {
            for (const states of [{ watchlist: false, favorite: false, watched: false }, { watchlist: true, favorite: true, watched: false }]) {
              const overlay = resolveCardOverlay({ variant, inLibrary, playable, resume, rateable: true, offline: false });
              const key = [variant, inLibrary ? "biblio" : "hors", playable ? "lisible" : "rien", resume ? "reprise" : "debut", providerFilterActive ? "filtre" : "-", states.watchlist ? "liste" : "-"].join("/");
              out[key] = sheetRows({ overlay, states, playDetail: playable ? "12:34" : null, inLibrary, providerFilterActive }, translate);
            }
          }
        }
      }
    }
  }
  return out;
}
