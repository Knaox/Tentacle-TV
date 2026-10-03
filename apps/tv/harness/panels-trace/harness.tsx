import "./stubs/clock";
import { runAbsentSheet } from "./units/absentSheet";
import { runActionSheet } from "./units/actionSheet";
import { runCardActions } from "./units/cardActions";
import { runChoiceEntry } from "./units/choiceEntry";
import { runFocusTarget } from "./units/focusTarget";
import { runOffline } from "./units/offline";
import { runRatingPanel } from "./units/ratingPanel";
import { runSeasons } from "./units/seasons";
import { runSheetFocus } from "./units/sheetFocus";
import { runSheetRows } from "./units/sheetRows";

/**
 * Le banc de traces des panneaux et des cartes : chaque unité rejoue ses
 * scénarios sur les modules de l'arbre construit (référence ou courant) et
 * rend sa trace ; `bench.mjs` compare.
 */

const units: Record<string, unknown> = {
  choiceEntry: runChoiceEntry(),
  sheetFocus: runSheetFocus(),
  focusTarget: runFocusTarget(),
  sheetRows: runSheetRows(),
  ratingPanel: runRatingPanel(),
  offline: runOffline(),
  cardActions: await runCardActions(),
  actionSheet: await runActionSheet(),
  seasons: await runSeasons(),
  absentSheet: await runAbsentSheet(),
};

// Une sortie longue part par morceaux dans un tube : on ne quitte qu'une fois tout écrit.
process.stdout.write(JSON.stringify({ units }), () => process.exit(0));
