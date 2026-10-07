// Le mode de mesure (Android TV, éteint par défaut) d'abord : son crochet doit
// exister avant que le moteur de React ne se charge.
import "./src/platform/perf/install";
import { AppRegistry } from "react-native";
// Le profil de montage (mode Lite) posé avant le premier rendu.
import "./src/redesignWiring/render/mountTier";
// Relevé de l'espace de points (dev seulement) — ici et non dans App.tsx, déjà à 302 lignes.
import "./src/utils/screenMetricsDiag";
import { App } from "./src/App";
import { name as appName } from "./app.json";

AppRegistry.registerComponent(appName, () => App);
