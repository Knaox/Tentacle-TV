import { AppRegistry } from "react-native";
// Relevé de l'espace de points (dev seulement) — ici et non dans App.tsx, déjà à 302 lignes.
import "./src/utils/screenMetricsDiag";
import { App } from "./src/App";
import { name as appName } from "./app.json";

AppRegistry.registerComponent(appName, () => App);
