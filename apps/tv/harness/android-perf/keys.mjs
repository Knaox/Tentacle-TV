#!/usr/bin/env node
// Une séquence de touches GARDÉE (`keyGuard.mjs` : app de mesure seulement,
// touches système refusées, premier plan vérifié avant chaque appui), puis
// une capture d'écran — pour un geste à la main pendant une passe.
//
//   ANDROID_SERIAL=emulator-5692 node keys.mjs <capture.png|-> tap:21 tap:20x3@400 tap:23
import { createDevice } from "./lib/device.mjs";

const [shot, ...steps] = process.argv.slice(2);
const device = createDevice();
device.keys(...steps);
await new Promise((resolve) => setTimeout(resolve, 1500));
if (shot && shot !== "-") device.screencap(shot);
