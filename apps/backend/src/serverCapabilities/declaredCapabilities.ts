import { SERVER_CAPABILITY_KEYS, type ServerCapability } from "./serverCapabilities";

/**
 * `GET /api/config` → `capabilities` : ce que CE serveur sait faire.
 *
 * Le miroir est celui de la version du serveur : chaque clé qu'il porte, son
 * code la sert. Toutes sont donc déclarées. Une fonction que l'administration
 * peut COUPER n'est pas une capacité mais un réglage : elle va dans
 * `features` (cf. `features.family`), qui dit ce qui est permis.
 */
export function declaredServerCapabilities(): ServerCapability[] {
  return [...SERVER_CAPABILITY_KEYS];
}
