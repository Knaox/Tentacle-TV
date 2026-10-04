/**
 * Inline les drapeaux de DÉVELOPPEMENT de la refonte TV dans le bundle :
 * - `process.env.TENTACLE_TV_REDESIGN` : la refonte sur Android TV
 *   (`src/redesignWiring/redesignGate.ts`) ;
 * - `process.env.TENTACLE_TV_REMOTE_LOG` : le journal de la télécommande
 *   (`src/platform/androidtv/input/remoteLog.ts`), chaque signal et
 *   l'intention qu'il porte, dans la console (Metro, logcat `ReactNativeJS`).
 *
 * La valeur est celle de l'environnement du processus qui transforme le code :
 * Metro (`TENTACLE_TV_REDESIGN=1 react-native start`, ce que fait
 * `pnpm tv:refonte:android`) ou le bundle d'une build Gradle lancée avec la
 * variable. Absente — la CI, toute build de production —, l'expression vaut
 * `undefined` : rien ne change. Le cache de Metro suit les valeurs
 * (`cacheVersion` de `metro.config.js`) : changer une variable ne sert jamais
 * un bundle transformé avec l'autre.
 *
 * Retiré quand Android TV basculera pour de bon sur la refonte (tâche A5).
 */
const NAMES = ["TENTACLE_TV_REDESIGN", "TENTACLE_TV_REMOTE_LOG"];

module.exports = function inlineRedesignFlag({ types: t }) {
  return {
    name: "tentacle-inline-redesign-flag",
    visitor: {
      MemberExpression(path) {
        const name = NAMES.find((candidate) => path.matchesPattern(`process.env.${candidate}`));
        if (!name) return;
        const value = process.env[name];
        path.replaceWith(value === undefined ? t.identifier("undefined") : t.stringLiteral(value));
      },
    },
  };
};
