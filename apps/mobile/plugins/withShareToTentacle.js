/**
 * Le config plugin du PARTAGE SYSTÈME vers Tentacle TV : un lien de playlist partagé depuis Spotify,
 * YouTube Music, Deezer, Apple Music… ouvre Tentacle TV, qui l'importe (route `/octave/import?shared=`).
 * - iOS : l'extension de partage `ShareToTentacle` (`shareToTentacle/ios.js`) ;
 * - Android : l'intent `SEND` de texte sur l'activité principale (`shareToTentacle/android.js`).
 * Les deux rendent le texte reçu tel quel dans `tentacle://octave/import?shared=<texte>` : la règle qui y
 * trouve le lien est en JavaScript (`sharedImportLink`, shared), testée. Exige un build natif.
 */

const withShareToTentacleIos = require("./shareToTentacle/ios");
const withShareToTentacleAndroid = require("./shareToTentacle/android");

module.exports = function withShareToTentacle(config) {
  return withShareToTentacleAndroid(withShareToTentacleIos(config));
};
