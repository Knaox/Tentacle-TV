import type { SetupHostInfo } from "@tentacle-tv/shared";

/**
 * Où lire le code d'installation, selon la façon dont le serveur tourne. Le
 * serveur ne parle jamais à Docker : il dit seulement ce qu'il sait de
 * lui-même (`GET /api/setup/host`) — conteneur ou non, son identifiant court.
 * Les commandes visent cet IDENTIFIANT, qui marche quel que soit le nom du
 * service ou du conteneur ; à défaut, un repère à remplacer.
 *
 * `host` : `undefined` tant que la réponse n'est pas venue, `null` si elle ne
 * viendra pas (serveur d'avant la route) — on montre alors tous les chemins.
 */
export type CodeHelpTab = "docker" | "portainer" | "compose" | "nas" | "native";

/** Le nom du service dans les piles officielles (`stacks/tentacle-*`). */
export const COMPOSE_SERVICE = "tentacle";
export const TOKEN_COMMAND = "tentacle setup token";
export const NATIVE_TOKEN_COMMAND = "node apps/backend/dist/cli/tentacle.js setup token";

const CONTAINER_TABS: readonly CodeHelpTab[] = ["docker", "portainer", "compose", "nas"];
const ALL_TABS: readonly CodeHelpTab[] = [...CONTAINER_TABS, "native"];

export function codeHelpTabs(host: SetupHostInfo | null | undefined): readonly CodeHelpTab[] {
  if (!host) return ALL_TABS;
  return host.containerized ? CONTAINER_TABS : ["native"];
}

/** L'onglet le plus probable : la ligne de commande si l'identifiant est connu, sinon Compose. */
export function initialCodeHelpTab(host: SetupHostInfo | null | undefined): CodeHelpTab {
  if (host && !host.containerized) return "native";
  return host?.containerId ? "docker" : "compose";
}

export interface CodeHelpCommands {
  dockerLogs: string;
  dockerToken: string;
  composeLogs: string;
  composeToken: string;
}

/** `placeholder` remplace l'identifiant quand le serveur n'a pas pu le lire (« <conteneur> »). */
export function codeHelpCommands(containerId: string | null, placeholder: string): CodeHelpCommands {
  const target = containerId ?? placeholder;
  return {
    dockerLogs: `docker logs ${target}`,
    dockerToken: `docker exec ${target} ${TOKEN_COMMAND}`,
    composeLogs: `docker compose logs ${COMPOSE_SERVICE}`,
    composeToken: `docker compose exec ${COMPOSE_SERVICE} ${TOKEN_COMMAND}`,
  };
}
