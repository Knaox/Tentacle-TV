/**
 * Inline `process.env.TENTACLE_TV_REDESIGN` dans le bundle — l'aiguillage de
 * DÉVELOPPEMENT de la refonte sur Android TV (`src/redesignWiring/redesignGate.ts`).
 *
 * La valeur est celle de l'environnement du processus qui transforme le code :
 * Metro (`TENTACLE_TV_REDESIGN=1 react-native start`, ce que fait
 * `pnpm tv:refonte:android`) ou le bundle d'une build Gradle lancée avec la
 * variable. Absente — la CI, toute build de production —, l'expression vaut
 * `undefined` et la refonte reste éteinte sur Android. Le cache de Metro suit
 * la valeur (`cacheVersion` de `metro.config.js`) : changer la variable ne sert
 * jamais un bundle transformé avec l'autre.
 *
 * Retiré quand Android TV basculera pour de bon sur la refonte (tâche A5).
 */
const NAME = "TENTACLE_TV_REDESIGN";

module.exports = function inlineRedesignFlag({ types: t }) {
  const value = process.env[NAME];
  return {
    name: "tentacle-inline-redesign-flag",
    visitor: {
      MemberExpression(path) {
        if (!path.matchesPattern(`process.env.${NAME}`)) return;
        path.replaceWith(value === undefined ? t.identifier("undefined") : t.stringLiteral(value));
      },
    },
  };
};
