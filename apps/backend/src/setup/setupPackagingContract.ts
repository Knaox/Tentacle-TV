/**
 * Comment le serveur est LIVRÉ, en plus de `deployment` (`SetupHostInfo`,
 * `SetupContext`) : `windows-app`, l'app Microsoft Store « Tentacle Server »
 * (un Node embarqué : `deployment` y vaut `native`, ce qui reste vrai). Champ
 * ADDITIF, jamais une valeur de plus dans `SetupDeployment` : un client livré
 * ignore ce qu'il ne connaît pas. Absent : image Docker, installation à la
 * main, ou serveur d'avant. L'écran du code y renvoie à l'icône de l'app, les
 * aides y parlent de Windows au lieu de Docker.
 *
 * MIROIR : recopié avec les autres `setup*Contract.ts` dans `apps/backend/src/setup/`.
 */
export type SetupPackaging = "windows-app";
