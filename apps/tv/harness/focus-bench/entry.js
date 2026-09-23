import { AppRegistry, LogBox } from "react-native";
import { Bench } from "./Bench";
import { name as appName } from "../../app.json";

// Le bandeau d'avertissement couvrirait le haut de l'écran : les messages
// restent lisibles dans logcat (étiquette ReactNativeJS).
LogBox.ignoreAllLogs(true);

// Même nom que l'app : l'activité native monte ce qu'on lui sert.
AppRegistry.registerComponent(appName, () => Bench);
