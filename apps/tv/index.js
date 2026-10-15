// Le mode de mesure (Android TV, éteint par défaut) d'abord : son crochet doit
// exister avant que le moteur de React ne se charge.
import "./src/platform/perf/install";
import { AppRegistry } from "react-native";
// Relevé de l'espace de points (dev seulement) — ici et non dans App.tsx, déjà à 302 lignes.
import "./src/utils/screenMetricsDiag";
// Les rangées de recommandation à thème (« Films pour vous ») : demandées avant toute requête.
import "./src/lib/recoThemes";
import { App } from "./src/App";
import { name as appName } from "./app.json";

AppRegistry.registerComponent(appName, () => App);
