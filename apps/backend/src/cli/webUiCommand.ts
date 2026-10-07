import { readOverrideFile, resolveWebUi, writeWebUiOverride } from "../static/webUi";

/**
 * `tentacle web on|off|default|status` — l'interface web du serveur, depuis
 * la console du conteneur : le moyen de revenir en arrière quand elle est
 * coupée (on ne peut plus la rallumer depuis elle). Prend effet en cinq
 * secondes, sans redémarrage. La commande l'emporte sur `TENTACLE_WEB_UI` ;
 * `default` lui rend la main.
 */
export const WEB_USAGE = [
  "  tentacle web on        rallume l'interface web (sans redémarrage)",
  "                         turn the web interface back on (no restart)",
  "  tentacle web off       coupe l'interface web (l'API, /tv et les applications restent)",
  "                         turn the web interface off (API, /tv and apps keep working)",
  "  tentacle web default   suit de nouveau TENTACLE_WEB_UI / follow TENTACLE_WEB_UI again",
  "  tentacle web status    dit l'état et d'où il vient / show the state and its source",
];

const SOURCES = {
  cli: "commande `tentacle web` / `tentacle web` command",
  env: "variable TENTACLE_WEB_UI / TENTACLE_WEB_UI variable",
  default: "par défaut / default",
} as const;

export function runWebCommand(action: string | undefined, env: NodeJS.ProcessEnv = process.env): number {
  if (action === "on" || action === "off") writeWebUiOverride(action);
  else if (action === "default") writeWebUiOverride(null);
  else if (action !== "status") {
    console.error(`Commande inconnue / unknown command : tentacle web ${action ?? ""}`.trim());
    for (const line of WEB_USAGE) console.error(line);
    return 2;
  }
  const { enabled, source } = resolveWebUi(env, readOverrideFile());
  console.log(enabled ? "Interface web : ALLUMÉE / Web interface: ON" : "Interface web : COUPÉE / Web interface: OFF");
  console.log(`Source : ${SOURCES[source]}`);
  if (action !== "status") console.log("Effet sous cinq secondes, sans redémarrage. / Takes effect within five seconds, no restart.");
  if (!enabled) console.log("L'API, /tv (TV LG) et les applications restent servies ; l'assistant aussi tant que l'installation n'est pas finie.");
  return 0;
}
