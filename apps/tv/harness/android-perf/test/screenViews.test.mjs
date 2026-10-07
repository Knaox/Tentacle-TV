import assert from "node:assert/strict";
import { test } from "node:test";
import { topScreenViews } from "../lib/lite/screenViews.mjs";

// Forme de `dumpsys activity top` (07/10, AVD de L5b), réduite : un autre
// paquet d'abord, puis une pile de deux écrans, l'accueil recouvert (I) et
// la fiche au-dessus, qui porte un écran imbriqué.
const DUMP = [
  "  ACTIVITY com.google.android.tvlauncher/.MainActivity 3ed5fc1 pid=1161",
  "      android.widget.FrameLayout{1 V.E...... ........ 0,0-1920,1080}",
  "  ACTIVITY com.tentacletv.mobile.perf/com.tentacletv.MainActivity 1ab1b26 pid=4712",
  "    View Hierarchy:",
  "      DecorView@2[MainActivity]",
  "        com.swmansion.rnscreens.ScreenStack{a V.E...... ........ 0,0-1920,1080}",
  "          com.swmansion.rnscreens.Screen{b I.E...... ........ 0,0-1920,1080}",
  "            com.facebook.react.views.view.ReactViewGroup{c V.E...... ........ 0,0-1920,1080}",
  "              com.facebook.react.views.view.ReactViewGroup{d V.E...... ........ 0,0-10,10}",
  "          com.swmansion.rnscreens.Screen{e V.E...... ........ 0,0-1920,1080}",
  "            com.facebook.react.views.view.ReactViewGroup{f V.E...... ........ 0,0-1920,1080}",
  "              com.swmansion.rnscreens.Screen{1a V.E...... ........ 0,0-1920,1080}",
  "                com.facebook.react.views.text.ReactTextView{1b V.ED..... ........ 0,0-10,10}",
  "        android.view.View{1c V.ED..... ........ 0,0-1,1}",
  "",
].join("\n");

test("vues de la page affichée : le Screen du dessus, sans la pile recouverte ni les autres paquets", () => {
  assert.equal(topScreenViews(DUMP, "com.tentacletv.mobile.perf"), 3);
});

test("vues de la page affichée : rien sans l'activité ou sans écran", () => {
  assert.equal(topScreenViews(DUMP, "com.autre"), null);
  assert.equal(topScreenViews("  ACTIVITY com.x/.A 1 pid=1\n    View{1 V.E}", "com.x"), null);
});
