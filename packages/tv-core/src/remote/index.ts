/**
 * La télécommande, en trois couches — l'architecture est dans
 * `docs/TV-NAVIGATION.md` :
 *
 * 1. les INTENTIONS (`intents.ts`) : ce que veut l'utilisateur, sans rien de
 *    matériel ;
 * 2. les TABLES DE TRADUCTION (`bindings/`) : une par plateforme, des
 *    données — signal natif → intention ;
 * 3. la RÉSOLUTION (`contexts.ts`, `input.ts`) : selon le contexte actif,
 *    quel comportement prend l'intention. Les comportements eux-mêmes vivent
 *    dans les dossiers de domaine (`focus/`, `nav/`, `player/`…).
 */
export * from "./intents";
export * from "./signals";
export * from "./bindings/types";
export * from "./bindings/hints";
export * from "./bindings/tvos";
export * from "./bindings/androidtv";
export * from "./translate";
export * from "./contexts";
export * from "./input";
export * from "./backTakers";
