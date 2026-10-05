/**
 * Inline le drapeau de DÉVELOPPEMENT du journal de la télécommande dans le
 * bundle : `process.env.TENTACLE_TV_REMOTE_LOG`
 * (`src/platform/androidtv/input/remoteLog.ts`), chaque signal et l'intention
 * qu'il porte, dans la console (logcat `ReactNativeJS`).
 *
 * La valeur est celle de l'environnement du processus qui transforme le code :
 * Metro (`TENTACLE_TV_REMOTE_LOG=1 react-native start`, ce que fait
 * `pnpm tv:refonte:android --journal`) ou le bundle d'une build Gradle lancée
 * avec la variable. Absente — la CI, toute build de production —, l'expression vaut
 * `undefined` : rien ne change. Le cache de Metro suit les valeurs
 * (`cacheVersion` de `metro.config.js`) : changer une variable ne sert jamais
 * un bundle transformé avec l'autre.
 *
 * L'aiguillage de la refonte sur Android (`TENTACLE_TV_REDESIGN`) en est
 * parti à la bascule (A5) : la refonte y est l'UI tout court.
 */
const NAMES = ["TENTACLE_TV_REMOTE_LOG"];

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
