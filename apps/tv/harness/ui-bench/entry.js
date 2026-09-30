import { AppRegistry, LogBox } from "react-native";
import { UiBench } from "./UiBench";
import { name as appName } from "../../app.json";

// Le bandeau d'avertissement couvrirait le bas des captures : les messages
// restent dans la console de l'inspecteur.
LogBox.ignoreAllLogs(true);

// Même nom que l'app : l'application native monte ce qu'on lui sert.
AppRegistry.registerComponent(appName, () => UiBench);
